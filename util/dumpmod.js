// js.audiodemo - Sergei Lewis 2012
// Distributed under the Do Whatever You Want license:
// 1. You just do whatever you want.
//
// https://github.com/sl236/audiodemo/

// emulate typed arrays
function Uint8Array() { };
Uint8Array = Array.prototype.constructor;
Uint8Array.prototype.subarray = function( start, end )
{
	var end = (end>=start) ? end : this.length;
	var result = [];
	for( var i = start; i < end; ++i )
	{
		result.push(this[i]);
	}
	return result;
}

function Float32Array() { };
Float32Array = Uint8Array.prototype.constructor;
Float32Array.prototype.subarray = Uint8Array.prototype.subarray

function Hex(data,digits)
{
	var result = (data|0).toString(16);
	digits=digits||0;
	while( result.length < digits )
	{
		result='0'+result;
	}
	return result;
}

// ----

if( typeof(window)!='undefined' ) { alert("This is a commandline tool for use with Rhino."); } else {
// --------------------------------------------------------------------------------------------------
(function(filename){
load('framework/tracker.js');

var mod = new TrackerModule( readFile( filename ) );
var channelCount = mod.GetChannelCount();
var patternCount = mod.patternData.length;

var playtime = Math.ceil(mod.GetPlayTime());
var s = playtime % 60;
s = (s < 10) ? '0' + s : s;
playtime = Math.floor(playtime / 60);
var m = playtime % 60;
m = (m < 10) ? '0' + m : m;
var h = Math.floor(playtime / 60);
playtime = h ? h + ':' + m + ':' + s : m + ':' + s;

print( "'"+mod.GetTitle()+"',", playtime );
print( "'"+ mod.footer.magic + "'", channelCount, 'channels', mod.samples.length, 'samples', mod.footer.songPositions, 'song positions', patternCount, 'patterns' );
print("\nSamples:");
for( var i = 1; i < mod.samples.length; i++ )
{
	var sample = mod.samples[i];
	print( i+':', "'"+sample.title+"'", 
			'len', sample.len, 
			'volume', sample.volume, 
			'finetune', sample.finetune,
			'repeat from', sample.repeat_start,
			'for', sample.repeat_length );
}

var order = "\nOrder: ";
for( var i = 0; i < mod.footer.songPositions; i++ )
{
	order += Hex( mod.footer.patterns[i], 2 ) + " ";
}
print(order);

var blanks = ['', ' ', '  ', '   '];
function digitsOrBlanks(data,count)
{
	return data?Hex(data,count):blanks[count];
}

for( var i = 0; i < patternCount; i++ )
{
	print("\nPattern", Hex(i,2));

	var div = 0;
	var pattern = mod.patternData[i];
	while( div < pattern.length )
	{
		var line = Hex(div,2)+":  ";
		for( var j = 0; j < channelCount; ++j, ++div )
		{
			line += "|";
			var ddat = pattern[div];
			var dtext = digitsOrBlanks(ddat.sample,2)+" "
						+digitsOrBlanks(ddat.param,3)+" "
						+(ddat.effect? (Hex(ddat.effect)+Hex(ddat.X)+Hex(ddat.Y)) : "   ");
			line += dtext+"|  ";
		}
		print(line);
	}
}

})(arguments[0]); 
// --------------------------------------------------------------------------------------------------
}