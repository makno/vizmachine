/* 
VizMachine

Copyright 2003,2015 by
DI(FH) Mathias Knoll, MSc
mathias.knoll-AT-fh-joanneum.at

GNU AFFERO GENERAL PUBLIC LICENSE 
Version 3, 19 November 2007
See LICENSE.txt
*/

// Toggles tool tip representation by bootstrap
$(document).ready(function(){
    $('[data-toggle="tooltip"]').tooltip();
});

$('#vizArchitecture a.tabu').click(function (e) {
  e.preventDefault();
  $(this).tab('show');
});

$('#vizOpcodes a.tabu').click(function (e) {
  e.preventDefault();
  $(this).tab('show');
});

$('#vizMachine a.tabu').click(function (e) {
  e.preventDefault();
  $(this).tab('show');
});

$('#vizAssembler a.tabu').click(function (e) {
  e.preventDefault();
  $(this).tab('show');
});

$('#vizScreen a.tabu').click(function (e) {
  e.preventDefault();
  $(this).tab('show');
});

$('#vizAbout a.tabu').click(function (e) {
  e.preventDefault();
  $(this).tab('show');
});
