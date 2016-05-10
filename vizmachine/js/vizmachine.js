/* 
VizMachine

Copyright 2003,2015 by
DI(FH) Mathias Knoll, MSc
mathias.knoll-AT-fh-joanneum.at

GNU AFFERO GENERAL PUBLIC LICENSE 
Version 3, 19 November 2007
See LICENSE.txt
*/

// Utitlities
function dec2Bin(dec){
    return (dec >>> 0).toString(2);
}

// C O R E
// Main class
function Viz(){
	for(var i=0;i<Viz.sizeMemory;i++){
		this.cellsMemory[i] = new VCell(i);
	}
	for(var i=0;i<Viz.sizeRegister;i++){
		this.cellsRegister[i] = new VCell(i);
	}
	this.isInitialized = true;
};
// Main class members
Viz.p = Viz.prototype; // Short cut to prototype
Viz.p.constructor = Viz; // Short cut to access class
// Class settings
Viz.p.constructor.debuglevels = {DEBUG:0,INFO:1,WARNING:2,CRITICAL:3};
Viz.p.constructor.runlevels = {HALT:0,STEP:1,TOHALT:2};
Viz.p.constructor.commands = ['NONE','LOAD','LOAD','STORE','MOVE','ADD','ADD','OR','AND','XOR','ROTATE','JUMP','HALT','WAIT','WRITE'];
Viz.p.constructor.logical = {AND:0,OR:1,XOR:2};
Viz.p.constructor.sizeMemory = 256;
Viz.p.constructor.sizeRegister = 16;
Viz.p.constructor.floatNAN = '01110001';
Viz.p.constructor.floatPosInfinity = '01110000';
Viz.p.constructor.floatNegInfinity = '11110000';
// Object settings
Viz.p.debuglevel = Viz.debuglevels.INFO;
Viz.p.runlevel = Viz.runlevels.HALT;
Viz.p.cellsMemory = [];
Viz.p.cellsRegister = [];
Viz.p.cellProgramCounter = new VCell();
Viz.p.cellInstructionRegister = new VCell()
Viz.p.command =  new VCommand(); // Initially empty command
Viz.p.isInitialized = false;
// Class methods
Viz.p.constructor.processLogical = function(logical, reg1, reg2){
	switch(logical){
		case Viz.logical.AND:
			return reg1 & reg2;
		case Viz.logical.OR:
			return reg1 | reg2;
		case Viz.logical.XOR:
			return reg1 ^ reg2;
		default:
			return false;
	}
};
Viz.p.constructor.processBitShift = function(data, number){
	var zValue = data;
	return (data >> number);
};
Viz.p.constructor.getCmd = function(iCmd){
	return Viz.commands[iCmd];
};
Viz.p.constructor.processComplement = function(reg1, reg2){
	var result = reg1 + reg2;
	return result%256;
};
Viz.p.constructor.processFloat= function(reg1,reg2){
	
	var intResult = parseInt(Viz.floatNAN);
	
	var binReg1 = reg1.toString(2);
	var binReg2 = reg2.toString(2);
	binReg1 = Viz.fillGaps(binReg1,8);
	binReg2 = Viz.fillGaps(binReg2,8);
	var sign1 = Math.pow(-1,(2-parseInt(binReg1.substr(0,1))));
	var sign2 = Math.pow(-1,(2-parseInt(binReg2.substr(0,1))));
	var bias = 3;
	var exponent1 = parseInt(binReg1.substr(1,3),2);
	var exponent2 = parseInt(binReg2.substr(1,3),2);
	var mantisse1 = (exponent1==0)?'0':'1';
	var mantisse2 = (exponent2==0)?'0':'1';
	var significand1 = mantisse1 + binReg1.substr(4,4);
	var significand2 = mantisse2 +binReg2.substr(4,4);
	
	var signCommon = '0';
	var exponentCommon = exponent1; // init with 1st exponent
	
	// to infinity and beyond
	if((exponent1==7&&significand1=='0000')||(exponent2==7&&significand2=='0000')){
		return parseInt(Viz.floatPosInfinity);
	}
	
	// to NaN
	if((exponent1==7&&significand1!='0000')||(exponent2==7&&significand2!='0000')){
		return parseInt(Viz.floatNaN);
	}
	
	if(exponent1>exponent2){
		var shift = exponent1-exponent2;
		for(var i=0;i<shift;i++){
			significand2 = '0' + significand2;
			significand1 = significand1 + '0';
		}
	}
	if(exponent2>exponent1){
		exponentCommon = exponent2;
		var shift = exponent2-exponent1;
		for(var i=0;i<shift;i++){
			significand1 = '0' + significand1;
			significand2 = significand2 + '0';
		}
	}	
	significand1 = significand1.substr(0,1) + '.' + significand1.substr(1);
	significand2 = significand2.substr(0,1) + '.' + significand2.substr(1);
	var result = '';
	var handover = 0;
	if(significand1.length == significand2.length){
		for (var i=(significand1.length-1);i>=0;i--){
			if(significand1[i]=='.'){
				result = '.' + result;
			}else {
				var resultTmp = parseInt(significand1[i])+parseInt(significand2[i]);
				resultTmp = resultTmp+handover;
				handover = 0;
				if(resultTmp==2){
					handover=1; resultTmp=0;
				}else if(resultTmp==3){
					handover=1; resultTmp=1;
				}
				result = resultTmp + '' + result;
			}
		}
		if(handover!=0){
			result = '1' + result;
		}
		
		var indexOne = result.indexOf('1');
		var shiftComma = result.indexOf('.')-1;
		if(indexOne>0){
			shiftComma = -indexOne;
		}
		
		exponentCommon = exponentCommon + shiftComma;
		intResult = parseInt((signCommon+Viz.fillGaps(exponentCommon.toString(2),3)+result.substr(shiftComma+2,4)),2);
	}
	return intResult;
};
Viz.p.constructor.fillGaps = function(binValue, digits){
	var len = binValue.length;
	if(len<digits){
		for(var i=0;i<(digits-len);i++){
			binValue = '0'+binValue;
		}
	}
	return binValue;
};
// Object methods
Viz.p.processInstruction = function(){
	var opcode = this.cellsMemory[parseInt(this.cellProgramCounter.data)].dataHex();
	var address = this.cellProgramCounter.dataHex();

	// Advance in program for two steps (=hexByte)
	if(this.cellProgramCounter.data==(Viz.sizeMemory-1)){
		this.command = new VCommand();
		return;
	}else{
		this.cellProgramCounter.data = parseInt(this.cellProgramCounter.data)+1;
		address += this.cellProgramCounter.dataHex();
		opcode += this.cellsMemory[parseInt(this.cellProgramCounter.data)].dataHex();
		this.cellProgramCounter.data = parseInt(this.cellProgramCounter.data)+1;
	}
	
	this.command = new VCommand(opcode);
	this.command.address = address.toUpperCase();
	
	switch(this.command.command.codeDec){
			case 1: // RXY (1) - LOAD Reg R with content of cell-adress XY.
				this.cellsRegister[this.command.parameters[0]].data = this.cellsMemory[this.command.parameters[1]].data;
				break;
			case 2: // RXY (1) - LOAD Reg R with value (Bit format) XY.
				this.cellsRegister[this.command.parameters[0]].data = this.command.parameters[1];
				break;
			case 3: // RXY (1) - STORE Content of Reg R in memory cell with address XY
				this.cellsMemory[this.command.parameters[1]].data = this.cellsRegister[this.command.parameters[0]].data;
				break;
			case 4: // 0RS (2) - MOVE Content of Reg R to Reg S.
				this.cellsRegister[this.command.parameters[1]].data = this.cellsRegister[this.command.parameters[0]].data;
				this.cellsRegister[this.command.parameters[0]].data = 0;
				break;
			case 5: // RST (3) - ADD Content of Reg S and Reg T (2-Complement interpretation), Result saved in Reg R.
				this.cellsRegister[this.command.parameters[0]].data = Viz.processComplement(
					this.cellsRegister[this.command.parameters[1]].data, 
					this.cellsRegister[this.command.parameters[2]].data
				);
				break;
			case 6: // RST (3) - ADD Content of Reg S and Reg T (Floating-Point interpretation), Result saved in Reg R.
				this.cellsRegister[this.command.parameters[0]].data = Viz.processFloat(
					this.cellsRegister[this.command.parameters[1]].data, 
					this.cellsRegister[this.command.parameters[2]].data
				);
				break;
			case 7: // RST (3) - OR of Bits of Reg S and T, save Result in Reg R.
				this.cellsRegister[this.command.parameters[0]].data = Viz.processLogical(
						Viz.logical.OR,
						this.cellsRegister[this.command.parameters[1]].data, 
						this.cellsRegister[this.command.parameters[2]].data
					);
				break;
			case 8: // RST (3) - AND of Bits of Reg S and T, save Result in Reg R.
				this.cellsRegister[this.command.parameters[0]].data = Viz.processLogical(
						Viz.logical.AND,
						this.cellsRegister[this.command.parameters[1]].data, 
						this.cellsRegister[this.command.parameters[2]].data
					);
				break;
			case 9: // RST (3) - XOR of Bits of Regs S and T, save Result in Reg R.
				this.cellsRegister[this.command.parameters[0]].data = Viz.processLogical(
						Viz.logical.XOR,
						this.cellsRegister[this.command.parameters[1]].data, 
						this.cellsRegister[this.command.parameters[2]].data
					);
				break;
			case 10:// R0X (4) - ROTATE Bits of Reg R one Bit to the right, X-times.
				this.cellsRegister[this.command.parameters[0]].data = Viz.processBitShift(
						this.cellsRegister[this.command.parameters[0]].data,
						parameters[1]
					);
				break;
			case 11:// RXY (1) - JUMP to Instruction in memory-cell with address XY,
				if(this.cellsRegister[0].data==this.cellsRegister[this.command.parameters[0]].data)
					this.cellProgramCounter.data = parseInt(this.command.parameters[1]);
				break;
			case 12:// 000 - HALT.
				this.runlevel = Viz.runlevels.HALT;
				break;
			case 13:// XYZ - WAIT.
				console.log("WAITING " + this.command.parameters[0] + "ms. (Handled by GUI!)");
				break;
			case 14:// RST - WRITE. - STORE Content of Reg R in memory cell with given address in Reg T
				this.cellsMemory[this.cellsRegister[this.command.parameters[2]].data].data = this.cellsRegister[this.command.parameters[0]].data;
				break;
	}
};
Viz.p.resetRegister = function(){
	for(var i=0;i<Viz.sizeRegister;i++){
		this.cellsRegister[i].data=0;
	}
};
Viz.p.resetMemory = function(){
	for(var i=0;i<Viz.sizeMemory;i++){
		this.cellsMemory[i].data=0;
	}
};
Viz.p.dumpMemory = function(){
	var ret = '';
	for(var i=0;i<Viz.sizeMemory;i++){
		ret+=this.cellsMemory[i].dataHex();
	}
	return ret;
};
// EOF Viz



// C E L L 
// Memory cell class
function VCell(){
	if(arguments.length==1){
		this.number = arguments[0];
	}
};
// Main class members
VCell.p = VCell.prototype; // Short cut to prototype
VCell.p.constructor = VCell; // Short cut to access class
// Class settings
VCell.p.constructor.datatype = {DEC:0,HEX:1,BIN:2,OCT:3};
// Object settings
VCell.p.data = 0;
// Object methods
VCell.p.dataHex = function(){
	var ret = this.data.toString(16).toUpperCase(); 
	if(ret.length==1)
		ret = '0'+ret;
	return ret;
};
VCell.p.dataBin = function(){
	var ret = this.data.toString(2);
	var len = ret.length;
	if(len<8){
		for(var i=0;i<(8-len);i++){
			ret = '0'+ret;
		}
	}
	return ret;
};
// C O M M A N D 
// Command class
function VCommand(){
	if(arguments.length==2 && typeof(arguments[0])=='number' && typeof(arguments[1])=='array'){
		this.command = arguments[0];
		this.parameters = arguments[1];
	}else if(arguments.length==1 && typeof(arguments[0])=='string' && arguments[0].length==4){
		this.parseCommand(arguments[0]);
	}
};
// Main class members
VCommand.p = VCommand.prototype; // Short cut to prototype
VCommand.p.constructor = VCommand; // Short cut to access class
// Class settings
VCommand.p.constructor.commands = {
	NONE:{codeDec:0,codeHex:'0',name:'NONE'},
	LOAD1:{codeDec:1,codeHex:'1',name:'LOAD1'},
	LOAD2:{codeDec:2,codeHex:'2',name:'LOAD2'},
	STORE:{codeDec:3,codeHex:'3',name:'STORE'},
	MOVE:{codeDec:4,codeHex:'4',name:'MOVE'},
	ADD1:{codeDec:5,codeHex:'5',name:'ADD1'},
	ADD2:{codeDec:6,codeHex:'6',name:'ADD2'},
	OR:{codeDec:7,codeHex:'7',name:'OR'},
	AND:{codeDec:8,codeHex:'8',name:'AND'},
	XOR:{codeDec:9,codeHex:'9',name:'XOR'},
	ROTATE:{codeDec:10,codeHex:'A',name:'ROTATE'},
	JUMP:{codeDec:11,codeHex:'B',name:'JUMP'},
	HALT:{codeDec:12,codeHex:'C',name:'HALT'},
	WAIT:{codeDec:13,codeHex:'D',name:'WAIT'},
	WRITE:{codeDec:14,codeHex:'E',name:'WRITE'}
};
VCommand.p.constructor.getParameters = function(opcode,type){
	var parameters = [];
	switch(type){
		case VCommand.parametertypes.RXY: // Type "R XY"
			parameters[0] = parseInt(opcode.substr(1,1),16);
			parameters[1] = parseInt(opcode.substr(2,2),16);
			break;
		case VCommand.parametertypes.ORS: // Type "0 RS"
			parameters[0] = parseInt(opcode.substr(2,1),16);
			parameters[1] = parseInt(opcode.substr(3,1),16);
			break;	
		case VCommand.parametertypes.RST: // Type "R S T"
			parameters[0] = parseInt(opcode.substr(1,1),16);
			parameters[1] = parseInt(opcode.substr(2,1),16);
			parameters[2] = parseInt(opcode.substr(3,1),16);
			break;	
		case VCommand.parametertypes.ROX: // Type "R 0 X"
			parameters[0] = parseInt(opcode.substr(1,1),16);
			parameters[1] = parseInt(opcode.substr(3,1),16);
			break;
		case VCommand.parametertypes.XYZ: // Type "XYZ"
			parameters[0] = parseInt(opcode.substr(1,3),16);
			break;
	}
	return parameters;
};
VCommand.p.constructor.parametertypes = {UNDEF:0,RXY:1,ORS:2,RST:3,ROX:4,XYZ:5};
VCommand.p.constructor.maxcommandnumber = 14;
// Object settings
VCommand.p.address = '';
VCommand.p.opcode = '';
VCommand.p.vcell1 = new VCell();
VCommand.p.vcell2 = new VCell();
VCommand.p.command = VCommand.commands.NONE;
VCommand.p.parametertype = VCommand.parametertypes.UNDEF;
VCommand.p.parameters = [];

// Object methods
VCommand.p.gstCommand = function(){
	if(arguments.length==0){
		return this.command;
	}else{
		var cmdInt = parseInt(arguments[0]);
		if(cmdInt<=VCommand.maxcommandnumber){
			this.command = $.map(VCommand.commands, function(value, index) { return [value]; })[cmdInt];
			var code = this.command.codeHex+this.vcell1.dataHex().substr(1);
			this.vcell1.data = parseInt(code,16);
		}
	}
};
VCommand.p.gstOperand = function(){
	if(arguments.length==0){
		return this.opcode.substr(1);
	}else{
		if(arguments.length==1){
			var isOk = true;
			for(var i=0; i<arguments[0].length;i++){
				if(isNaN(parseInt(arguments[0][i],16))){
					isOk = false;
					continue;
				}				
			}
			if(!isOk){
				this.vcell1.data = this.command.codeDec;
				this.vcell2.data = 0;
				this.opcode = this.command.codeHex + '000'; 
			}else{
				var tmpcode = ''; var tmpcode1 = '00';
				if(arguments[0].length>0){
					this.vcell1.data = parseInt((this.command.codeHex+arguments[0].substr(0,1)),16);
					tmpcode = this.command.codeHex + arguments[0].substr(0,1);
				}
				if(arguments[0].length==2){
					tmpcode1 = (arguments[0].substr(1,1)+'0');
					this.vcell2.data = parseInt(tmpcode1,16);
				}else if(arguments[0].length==3){
					tmpcode1 = arguments[0].substr(1);
					this.vcell2.data = parseInt(tmpcode1,16);
				}
				this.opcode = tmpcode + tmpcode1;
			}		
		}
	}
};
VCommand.p.parseCommand = function(opcode){
	// Sanity checks
	if(typeof(opcode)=='string' && opcode.length==4 && parseInt(opcode,16)!='NaN'){
		this.opcode = opcode;
		var commandHex = opcode.substr(0,1);
		var commandInt = parseInt(commandHex,16);
		// Handle op code
		switch(commandInt){
				case 1: // RXY (1) - LOAD Reg R with content of cell-adress XY.
					this.command = VCommand.commands.LOAD1;
					this.parametertype = VCommand.parametertypes.RXY;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.RXY);
					break;
				case 2: // RXY (1) - LOAD Reg R with value (Bit format) XY.
					this.command = VCommand.commands.LOAD2;
					this.parametertype = VCommand.parametertypes.RXY;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.RXY);
					break;
				case 3: // RXY (1) - STORE Content of Reg R in memory cell with address XY
					this.command = VCommand.commands.STORE;
					this.parametertype = VCommand.parametertypes.RXY;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.RXY);
					break;
				case 4: // 0RS (2) - MOVE Content of Reg R to Reg S.
					this.command = VCommand.commands.MOVE;
					this.parametertype = VCommand.parametertypes.ORS;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.ORS);
					break;
				case 5: // RST (3) - ADD Content of Reg S and Reg T (2-Complement interpretation), Result saved in Reg R.
					this.command = VCommand.commands.ADD1;
					this.parametertype = VCommand.parametertypes.RST;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.RST);
					break;
				case 6: // RST (3) - ADD Content of Reg S and Reg T (Floating-Point interpretation), Result saved in Reg R.
					this.command = VCommand.commands.ADD2;
					this.parametertype = VCommand.parametertypes.RST;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.RST);
					break;
				case 7: // RST (3) - OR of Bits of Reg S and T, save Result in Reg R.
					this.command = VCommand.commands.OR;
					this.parametertype = VCommand.parametertypes.RST;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.RST);
					break;
				case 8: // RST (3) - AND of Bits of Reg S and T, save Result in Reg R.
					this.command = VCommand.commands.AND;
					this.parametertype = VCommand.parametertypes.RST;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.RST);
					break;
				case 9: // RST (3) - XOR of Bits of Regs S and T, save Result in Reg R.
					this.command = VCommand.commands.XOR;
					this.parametertype = VCommand.parametertypes.RST;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.RST);
					break;
				case 10:// R0X (4) - ROTATE Bits of Reg R one Bit to the right, X-times.
					this.command = VCommand.commands.ROTATE;
					this.parametertype = VCommand.parametertypes.R0X;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.ROX);
					break;
				case 11:// RXY (1) - JUMP to Instruction in memory-cell with address XY,
					this.command = VCommand.commands.JUMP;
					this.parametertype = VCommand.parametertypes.RXY;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.RXY);
					break;
				case 12:// 000 - HALT.
					this.command = VCommand.commands.HALT;
					break;
				case 13:// XYZ - WAIT
					this.command = VCommand.commands.WAIT;
					this.parametertype = VCommand.parametertypes.XYZ;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.XYZ);
					break;
				case 14:// RST - WRITE
					this.command = VCommand.commands.WRITE;
					this.parametertype = VCommand.parametertypes.RST;
					this.parameters = VCommand.getParameters(opcode,VCommand.parametertypes.RST);
					break;
		}
	}
};



