/* 
VizMachine

Copyright 2003,2015 by
DI(FH) Mathias Knoll, MSc
mathias.knoll-AT-fh-joanneum.at

GNU AFFERO GENERAL PUBLIC LICENSE 
Version 3, 19 November 2007
See LICENSE.txt
*/
 
(function(){ 
 
	// Application "VizMachine"
	var app = angular.module("vizMachine", ["ui.bootstrap"]);
	
	app.config(['$compileProvider',
		function ($compileProvider) {
			$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|file|blob):/);
	}]);
	
	// Directive "onReadFile"
	app.directive('onReadFile', function ($parse) {
		return {
			restrict: 'A',
			scope: false,
			link: function(scope, element, attrs) {
				var fn = $parse(attrs.onReadFile);
				
				element.on('change', function(onChangeEvent) {
					var reader = new FileReader();
					
					reader.onload = function(onLoadEvent) {
						scope.$apply(function() {
							fn(scope, {$fileContent:onLoadEvent.target.result});
						});
					};
					reader.readAsText((onChangeEvent.srcElement || onChangeEvent.target).files[0]);
				});
			}
		};
	});
	
	app.directive('ngSvgwidth', function() {
        return function(scope, element, attrs) {
            scope.$watch(attrs.ngSvgwidth, function(value) {
                element.attr('width', value);
            });
        };
    });
	
	app.directive('ngSvgheight', function() {
        return function(scope, element, attrs) {
            scope.$watch(attrs.ngSvgheight, function(value) {
                element.attr('height', value);
            });
        };
    });
	
	app.directive('ngSvgx', function() {
        return function(scope, element, attrs) {
            scope.$watch(attrs.ngSvgx, function(value) {
                element.attr('x', value);
            });
        };
    });
	
	app.directive('ngSvgy', function() {
        return function(scope, element, attrs) {
            scope.$watch(attrs.ngSvgy, function(value) {
                element.attr('y', value);
            });
        };
    });
	
	// Filter on ranges
	app.filter('range', function() {
	  return function(input, min, max) {
		min = parseInt(min); //Make string input integer
		max = parseInt(max);
		for (var i=min; i<max; i++)
		  input.push(i);
		return input;
	  };
	});
	
	// Controller "VizMachineController"
	app.controller("vizController", ['$scope', '$timeout', function($scope,$timeout){
		
		// Version
		this.version = '2.2.3';
		
		// Viz Machine
		this.viz = new Viz();
			
		// Number Format
		this.numberformat = 'hex';
		
		// Fill number gaps
		this.filling = false;
		
		// Log toggle between on and off
		this.logtoggle = true;
		
		// CSS Formats
        this.cssCellActive = "cell_active"; // ProgramCounter is currently pointing there
        this.cssCellEmpty = "cell_empty"; // Empty cell - no data - no program counter
        this.cssCellWithCode = "cell_with_code"; // Cell with code = data > 0
		this.cssCellWithProgram = "cell_with_program"; // Cell with program code
		this.cssCellWithProgramAndCounter = "cell_with_program_and_counter"; // Cell with program code and where counter is
        this.cssCellHeader = "cell_header"; // cell which is header

		// Number Cells
		this.memnumbers = [];
		
		// Register Cells
		this.registercells = [];
		
		// Memory Cells
		this.memcells = [];
		
		// runtime of Engine
		this.runtime;
		this.runtimeupdate=0;
		this.isrunning=false;
		this.runtimemode="Run";
		
		// Command set
		this.vcommands = [];
		this.vcommand = new VCommand();
		this.commandtypes = $.map(VCommand.commands, function(value, index) { return [value]; }); // To array so that we can filter
		
        // Methods

		// Go through program- either one step at a time or until HALT or counter reaches then end
        this.play = function(stepwise, mode){
			
			if(mode=='button') {
				if(this.isrunning){
					this.stop();
					return;
				}
			}
			
			this.runInstruction();
		
			// Check for delay at start
			if(this.viz.command.command.codeDec==VCommand.commands.WAIT.codeDec){
					this.runtimeupdate = this.viz.command.parameters[0];
			}else{
					this.runtimeupdate = 0;
			}	
		
			if(
				(this.viz.command.command.codeDec>0&&this.viz.command.command.codeDec<=VCommand.maxcommandnumber)&&this.viz.command.command.codeDec!=VCommand.commands.HALT.codeDec&&!stepwise){
				this.runtime = $timeout(function(){ $scope.vctrl.play(false,"loop"); }, $scope.vctrl.runtimeupdate); 
				this.isrunning = true;
				this.runtimemode="Stop";
			}else{
				 this.stop();
			}
        };
		
		this.stop = function(){
			$timeout.cancel($scope.vctrl.runtime);
			this.isrunning = false;
			this.runtimemode="Run";
		};
		
		this.isRunning = function(){
			return this.isrunning == true;
		};
			
		this.isStopped = function(){
			return this.isrunning == false;
		};
		
		this.runInstruction = function(){
			this.viz.processInstruction();
			this.showInstructionInfo(this.viz.command); 
			this.updateAssembler();
			this.updateCells();
		};
		
		// Show nice info on instructions given ...
		this.showInstructionInfo = function(command){
			if(!this.logtoggle)
				return;
			var instrOK = true;
			var instrTxt='<tr>';
			instrTxt += '<td><b>'+command.address.substr(0,2)+'</b>|<b>'+command.address.substr(2,2)+'</b></td>';
			instrTxt += '<td>'+command.command.codeHex+' ('+command.command.name+')</td>';
			instrTxt += '<td>'+command.opcode+'</td>';
			switch(command.command.codeDec){
				case 1: // RXY (1) - LOAD Reg R with content of cell address XY.
					instrTxt += '<td><b>LOAD</b> register <b>R'+command.parameters[0].toString(16).toUpperCase()+'</b> with contents of <b>Cell '+command.parameters[1].toString(16).toUpperCase()+'</b> ('+this.viz.cellsMemory[command.parameters[1]].data+')</td>';
					break;
				case 2: // RXY (1) - LOAD Reg R with value (Bitformat) XY.
					instrTxt += '<td><b>LOAD</b> register <b>R'+command.parameters[0].toString(16).toUpperCase()+'</b> with value <b>'+command.parameters[1].toString(16).toUpperCase()+'</b></td>';
					break;
				case 3: // RXY (1) - STORE content of Reg R in memory cell with address XY
					instrTxt += '<td><b>STORE</b> content of register <b>R'+command.parameters[0].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[0]].data+') to <b>Cell '+command.parameters[1].toString(16).toUpperCase()+'</b></td>';
					break;
				case 4: // 0RS (2) - MOVE Content of Reg R to Reg S.
					instrTxt += '<td><b>MOVE</b> content of register <b>R'+command.parameters[0].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[0]].data+') to register <b>R'+command.parameters[1].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[1]].data+')</td>';
					break;
				case 5: // RST (3) - ADD Content of Reg S and Reg T (2-Complement interpretation), Result saved in Reg R.
					instrTxt += '<td><b>ADD</b> content of register <b>R'+command.parameters[1].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[1]].dataBin()+') and register <b>R'+command.parameters[2].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[2]].dataBin()+') using <b>2-complement</b> to register R'+command.parameters[0].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[0]].dataBin()+').</td>';
					break;
				case 6: // RST (3) - ADD Content of Reg S and Reg T (Floating-Point interpretation), Result saved in Reg R.
					instrTxt += '<td><b>ADD</b> content of register <b>R'+command.parameters[1].toString(16)+'</b> ('+this.viz.cellsRegister[command.parameters[1]].dataBin()+') and register <b>R'+command.parameters[2].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[2]].dataBin()+') using <b>floating point interpretation</b> to register R'+command.parameters[0].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[0]].dataBin()+')</td>';
					break;
				case 7: // RST (3) - OR of Bits of Reg S and T, save Result in Reg R.
					instrTxt += '<td><b>OR</b> on bits of register <b>R'+command.parameters[1].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[1]].dataBin()+') and register <b>R'+command.parameters[2].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[2]].dataBin()+') storing to register R'+command.parameters[0].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[0]].dataBin()+')</td>';
					break;
				case 8: // RST (3) - AND of Bits of Reg S and T, save Result in Reg R.
					instrTxt += '<td><b>AND</b> on bits of register <b>R'+command.parameters[1].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[1]].dataBin()+') and register <b>R'+command.parameters[2].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[2]].dataBin()+') storing to register R'+command.parameters[0].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[0]].dataBin()+')</td>';
					break;
				case 9: // RST (3) - XOR of Bits of Regs S and T, save Result in Reg R.
					instrTxt += '<td><b>XOR</b> on bits of register <b>R'+command.parameters[1].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[1]].dataBin()+') and register <b>R'+command.parameters[2].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[2]].dataBin()+') storing to register R'+command.parameters[0].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[0]].dataBin()+')</td>';
					break;
				case 10: // R0X (4) - ROTATE Bits of Reg R one Bit to the right, X-times.
					instrTxt += '<td><b>ROTATE</b> bits of register <b>R'+command.parameters[0].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[0]].dataBin()+') for <b>'+command.parameters[1]+' Bits to the right.</b></td>';
					break;
				case 11: // RXY (1) - JUMP to Instruction in memory-cell with address XY.
					instrTxt += '<td><b>JUMP</b> to instruction <b>Cell '+command.parameters[1].toString(16).toUpperCase()+'</b> if the value of register <b>R'+command.parameters[0].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[0]].data+') is same than in <b>R0</b> ('+this.viz.cellsRegister[0].data+').</td>';
					break;
				case 12: // 000 - HALT.
					instrTxt += '<td><b>HALT</b> through command <b>C000</b>.</td>';
					break;
				case 13: // XYZ - WAIT.
					instrTxt += '<td><b>WAIT</b> for '+command.parameters[0].toString(16)+'hex ('+command.parameters[0]+') milliseconds.</td>';
					break;
				case 14: // RST - WRITE.
					instrTxt += '<td><b>WRITE</b> content of register <b>R'+command.parameters[0].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[0]].dataHex()+') to memory cell address given within <b>R'+command.parameters[2].toString(16).toUpperCase()+'</b> ('+this.viz.cellsRegister[command.parameters[2]].dataHex()+')</td>';
					break;
				default:
					instrOK = false;
					// Odd commands there ...
			}
			instrTxt += '</tr>';
			if(instrOK)
				$('#infoInstructions tr:last').after(instrTxt);
		};
		
		// Tool tips
		this.getTooltip = function(vcell){
			var cmdInt = parseInt(vcell.dataHex().substr(0,1),16);
			if(vcell.number==255||cmdInt<=0||cmdInt>VCommand.maxcommandnumber)
				return 'No OP Code';
			var p1 = vcell.dataHex().substr(1,1).toUpperCase();
			var vcell2 = this.viz.cellsMemory[vcell.number+1];
			var p2 = vcell2.dataHex().substr(0,1).toUpperCase();
			var p3 = vcell2.dataHex().substr(1,1).toUpperCase();
		return this.getCommandDescription(cmdInt,[p1,p2,p3]);
		};		
			
		this.getCommandDescription = function(cmd,parms){	
			switch(cmd){
				case 1:
					return "LOAD R"+parms[0]+" with data from Cell"+parms[1]+parms[2];
				case 2:
					return "LOAD R"+parms[0]+" with value "+parms[1]+""+parms[2]+"hex("+parseInt((parms[1]+""+parms[2]),16).toString(2)+"bin,"+parseInt((parms[1]+""+parms[2]),16)+"dec)";
				case 3:
					return "STORE data from R"+parms[0]+" to Cell"+parms[1]+""+parms[2];
				case 4:
					return "MOVE data from R"+parms[1]+" to R"+parms[2];
				case 5:
					return "ADD data from R"+parms[1]+" and R"+parms[2]+" to R"+parms[0]+" (Two Complement)";
				case 6:
					return "ADD data from R"+parms[1]+" and R"+parms[2]+" to R"+parms[0]+" (Floating Point)";
				case 7:
					return "OR on R"+parms[1]+" and R"+parms[2]+" saved to R"+parms[0];	
				case 8:
					return "AND on R"+parms[1]+" and R"+parms[2]+" saved to R"+parms[0];
				case 9:
					return "XOR on R"+parms[1]+" and R"+parms[2]+" saved to R"+parms[0];
				case 10:
					return "ROTATE bits from R"+parms[0]+" to the right for "+parseInt(parms[2],16)+" times";
				case 11:
					return "JUMP to instruction in Cell"+parms[1]+parms[2]+" if data from R"+parms[0]+" equals R0";
				case 12:
					return "HALT";
				case 13:
					return "WAIT in ms for " + parms[0]+""+parms[1]+""+parms[2]+"hex("+parseInt((parms[0]+""+parms[1]+""+parms[2]),16).toString(2)+"bin,"+parseInt((parms[0]+""+parms[1]+""+parms[2]),16)+"dec)";
				case 14:
					return "WRITE bits from R" + parms[0]+" to Cell with address from R"+parms[2];
				default:
					return '';
			}
		};
		
		// Update machine
		this.updateMachine = function(){
			if(arguments.length==1){
				this.viz.cellProgramCounter.data=arguments[0].vcell.number;
			}
			this.updateAssembler();
			this.updateCells();
		};

		// Updates cells with distinct formats
        this.updateCells = function(){
			this.resetFormats();
			var first = this.viz.cellProgramCounter.data%16;
			this.memcells[Math.floor(this.viz.cellProgramCounter.data/16)][first].css=this.cssCellActive;
            if(first!=15){
				this.memcells[Math.floor(this.viz.cellProgramCounter.data/16)][first+1].css=this.cssCellActive;
            }else{
				if((this.viz.cellProgramCounter.data+1)<Viz.sizeMemory)
					this.memcells[Math.floor(this.viz.cellProgramCounter.data/16)+1][0].css=this.cssCellActive;
            }
			if(this.viz.cellProgramCounter.data<255){
				var cell = this.viz.cellsMemory[parseInt(this.viz.cellProgramCounter.data)];
				var cellnext = this.viz.cellsMemory[cell.number+1];
				this.vcommand = new VCommand(cell.dataHex()+cellnext.dataHex());
				this.vcommand.address = (Viz.fillGaps(cell.number.toString(16),2)+Viz.fillGaps(cellnext.number.toString(16),2)).toUpperCase();
				this.vcommand.vcell1 = cell;
				this.vcommand.vcell2 = cellnext;
			}
		};
		
		// Update assembler 
		
		this.updateAssembler = function(){
			this.vcommands = [];
			var i=parseInt(this.viz.cellProgramCounter.data);
			while((i+1)<255){
				var opcode = this.viz.cellsMemory[i].dataHex() + this.viz.cellsMemory[(i+1)].dataHex();
				var command = new VCommand(opcode);
				command.vcell1 = this.viz.cellsMemory[i];
				command.vcell2 = this.viz.cellsMemory[(i+1)];
				command.address = (Viz.fillGaps(i.toString(16),2) + Viz.fillGaps((i+1).toString(16),2)).toUpperCase();
				if(command.command == VCommand.commands.NONE || command.command == VCommand.commands.HALT){
					this.vcommands.push(command);
					return;
				}else{
					this.vcommands.push(command);
					i += 2;
				}
			}
		};
		
		
		// Initialize register cells - bind them to viz machine
		this.initRegisterCells = function(){
			for(var i=0;i<16;i++){
				this.registercells[i] = {};
				this.registercells[i].css = this.cssCellEmpty;
				this.registercells[i].parent = this;
				this.registercells[i].vcell = this.viz.cellsRegister[i];
				this.registercells[i].Data = this.Data; //Call to Getter and Setter
			}
		};

		// Initialize memory cells - bind them to viz machine
		this.initMemoryCells = function(){
			var cnt=0; var i=0; var j=0;
			for(var i=0;i<16;i++){
				this.memnumbers[i] = {};
				this.memnumbers[i].css = this.cssCellHeader;
				this.memnumbers[i].vcell = new VCell(i);
				this.memnumbers[i].vcell.data = i;
				this.memcells[i] = [];
				for(var j=0;j<16;j++){
					this.memcells[i][j] = {};
					this.memcells[i][j].css = this.cssCellEmpty;
                    this.memcells[i][j].parent = this;
					this.memcells[i][j].vcell = this.viz.cellsMemory[cnt];
                    this.memcells[i][j].Data = this.Data; //Call to Getter and Setter
					this.memcells[i][j].Color = this.Color; // Cell color used later in screen
					cnt++;	
				}
			}
		};
		

		this.Color = function(value){
			if(value!==null&&typeof(value)!="undefined"){
				this.vcell.data = value;
			}else{
				return 'rgb('+(256-this.vcell.data)+','+(256-this.vcell.data)+','+(256-this.vcell.data)+')';
			}
		}
		
		// Getter Setter for Data in Cells in General
		this.Data = function(value){
			if(value!==null&&typeof(value)!="undefined"){
				var wert;
				var len = value.length;
				if(value=="")
					wert = 0
				switch(this.parent.numberformat){
					case 'hex':
						if(len>2)
							return;
						wert = parseInt(value,16);
						break;
					case 'bin':
						if(len>8)
							return;
						wert = parseInt(value,2);
						break;
					case 'dec':
					default:
						wert = parseInt(value);
				}
				if(isNaN(wert)||wert<0||wert>255)
					wert=0;
				this.vcell.data = wert;
			} else{
				return this.parent.getNumber(this.vcell.data, this.parent.fillgaps);
			} 			
		};
		
		// Delivers a number depending on number format
        this.getNumber = function(value,fillgaps){
            var wert;
            if(value===null||value=="")
                wert = 0
            switch(this.numberformat){
                case 'hex':
                    wert = value.toString(16).toUpperCase();
					if(this.filling){
						if(wert.length==1)
							wert = '0'+wert;
                    }
					break;
                case 'bin':
                    wert = value.toString(2);
                    var len = wert.length;
					if(this.filling){
						if(len<8){
						   for(var i=0;i<(8-len);i++){
							   wert = '0'+wert;
						   }
						}
					}
                    break;
                case 'dec':
                default:
                    wert = value;
            }
            return wert;
        };
		
		// Reset memory cell formats - reset to specific format!
		this.resetFormats = function(){
			// Register
			for(var i=0;i<16;i++){
				var cellActual = this.registercells[i];
				if(this.registercells[i].vcell.data!=0 ){
					cellActual.css = this.cssCellWithCode;
				}else{
					cellActual.css = this.cssCellEmpty;
				}
			}
			// Memory
			for(var i=0;i<16;i++){
				for(j=0;j<16;j++){
					var cellActual = this.memcells[i][j];
					var index = cellActual.vcell.number;
					var cellBefore = (index>1)?this.viz.cellsMemory[index-1]:null;
					var cellAfter = (index<254)?this.viz.cellsMemory[index+1]:null;
					if(this.memcells[i][j].vcell.data!=0 ){ // || ( (cellBefore!=null && cellBefore.data!=0) && (cellAfter!=null && cellAfter.data!=0) )
						cellActual.css = this.cssCellWithCode;
					}else{
						cellActual.css = this.cssCellEmpty;
					}
					for(var k=0;k<(this.vcommands.length);k++){
						if(this.vcommands[k].command!=VCommand.commands.NONE)
							if(this.vcommands[k].vcell1==this.memcells[i][j].vcell || this.vcommands[k].vcell2==this.memcells[i][j].vcell)
								cellActual.css = this.cssCellWithProgram;
					}
				}
			}
		};

		// Reset the program counter
        this.resetProgramCounter = function(){
            this.viz.cellProgramCounter.data=0;
			this.updateAssembler();
			this.updateCells();
        };
		
		// Reset register
		this.resetRegister = function(){
			this.viz.resetRegister();
			this.updateAssembler();
			this.updateCells();
		};

		// Reset memory
		this.resetMemory = function(){
			this.viz.resetMemory();
			this.updateAssembler();
			this.updateCells();
		};
		
		// Reset command log
		this.resetCommandLog = function(){
			$("#infoInstructions").find("tr:gt(1)").remove();
		};
		
		// Reset all
		this.resetAll = function(){
			this.resetRegister();
			this.resetMemory();
			this.resetProgramCounter();
			this.resetCommandLog();
		};
		
		// File upload with command set
				// File upload
		this.uploadContent = function($fileContent){
			var result = '';
			var data = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
			var content = $fileContent.toUpperCase();
			var counterCells = 0;
			this.resetMemory();
			this.resetRegister();
			for(var i=0;i<content.length;i++){
				var val = content[i];
				if(data.indexOf(val)!=-1){
					result += val;
				}
				if(result==''){
					break;
				}
				if(result.length==2){
					if(counterCells==(this.viz.sizeMemory-1))
						break;
					this.viz.cellsMemory[counterCells].data = parseInt(result,16);
					counterCells++;
					result='';
				}
			}
			this.resetProgramCounter();
		};
		
		this.downloadContent = function(){
			var today = new Date();
			var dd = today.getDate();
			var mm = today.getMonth()+1; //January is 0!
			var yyyy = today.getFullYear();
			if(dd<10) {
				dd='0'+dd;
			} 
			if(mm<10) {
				mm='0'+mm;
			} 
			
			var textFileAsBlob = new Blob([this.viz.dumpMemory()], {type:'text/plain'});
			var fileNameToSaveAs = 'vizmachine_dump_'+yyyy+mm+dd+'.vzm';
			saveAs(textFileAsBlob,fileNameToSaveAs);
		};
		
		// Show a picture of the current memory as a SVG drawing
		this.screen = Snap("#vScreen");
		this.screenGridSizeX = 20; // How large one cell is in the graphics
		this.screenGridSizeY = 20; // How large one cell is in the graphics
		this.screenGridSizeZ = 20; // How large one cell is in the graphics
		this.screenGridOffsetX = 20;
		this.screenGridOffsetY = 20;
		
		this.screencellnumber="";
		
		this.getGridWidth = function(){
			return 16*this.screenGridSizeX;
		};
		this.getGridHeight = function(){
			return 16*this.screenGridSizeY;
		};
		this.getSVGWidth = function(){
			return 16*this.screenGridSizeX+2*this.screenGridOffsetX;
		};
		this.getSVGHeight = function(){
			return 16*this.screenGridSizeY+2*this.screenGridOffsetY;
		};
		
		this.showSVGInfo = function(cell){
			// Show Value
			var ret = cell.vcell.number.toString(16).toUpperCase(); 
			if(ret.length==1)
			ret = '0'+ret;
			this.screencellnumber = ret;
			// Draw border
			
		};
		
		this.getASCII = function(cell_number){
			var cell = this.viz.cellsMemory[cell_number];
			if(cell != undefined && cell.data != 0){
				return String.fromCharCode(cell.data);
			}
			return '';
		}
		
		this.updateScreen = function(){
			//TBD
		};
		
		// Method Calls
		this.initMemoryCells();
		this.initRegisterCells();
        // Set program counter to start
        this.viz.cellProgramCounter.data = 0;
		// Update cells
        this.updateCells();
		// Update assembler
		this.updateAssembler();
		// Allow better editing in not fill 0 before 
		this.fillgaps = false;
		
	}]); 

})();




