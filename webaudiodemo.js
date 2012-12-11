// js.audiodemo - Sergei Lewis 2012
// Distributed under the Do Whatever You Want license:
// 1. You just do whatever you want.
//
// https://github.com/sl236/audiodemo/

var boot = null;
(function(){
// -----------------

function gotModule( data )
{
	var mod = new TrackerModule(data);

	// display some info
	var channelCount = mod.GetChannelCount();
	var text = '<b>js.audiodemo</b>';
	
	text += '<hr />';		
	text += '<div>';
		for( var i = 0; i < channelCount; i++ )
		{
			text += '<span id="ch' + i + '">&nbsp;&nbsp;&nbsp;&nbsp;</span> ';
		}
		text += '<span id="pause" style="border: 1px solid black;" onclick="boot.pause()">pause</span>';
	text += '</div>';
	text += '<br />';
	text += '<div class="progress"><div id="propthrough" style="width: 0px; height: 10px; background: black;"></div></div>';
	
    text += '<hr>';
	var playtime = Math.ceil( mod.GetPlayTime() );
	var s = playtime % 60;
	s = (s<10) ? '0' + s : s;
	playtime = Math.floor( playtime/60 );
	var m = playtime % 60;
	m = (m<10) ? '0' + m : m;
	var h = Math.floor( playtime/60 );
	playtime = h? h + ':' + m + ':' + s : m + ':' + s;
	
	text += '<div style="width: 20%">';
	text += '<pre>' + mod.GetTitle() + ': ' + mod.GetMagic() + " / " + playtime + "</pre>";	
	var samples = mod.GetSamples();
	
	for( var i = 1; i < samples.length; i++ )
	{
		text += '<pre id="smpl' + i + '">' + i + ' : ' + samples[i].title + ' / ' + samples[i].len + "</pre>";
	}
	text += '</div>';
    text += '<hr />';
    text += '<a href="https://github.com/sl236/audiodemo">GitHub repository</a>';
	$('body').html(text);
	var pauseElt = $('#pause');
	var propThroughElt = $('#propthrough');
	pauseElt.hide();
	
	var channelElts = [ ];
	for( var i = 0; i < channelCount; i++ )
	{
		channelElts[i] = document.getElementById('ch'+i);
	}

	var sampleElts = [ ];
	for( var i = 1; i < samples.length; i++ )
	{
		sampleElts[i] = document.getElementById('smpl'+i);
	}
	
	// play the module
	var handle = mod.Play();
	handle.SetVolume( 0.8 );
	boot.pause = function()
	{
		handle.Pause();
		pauseElt.html( handle.IsPaused() ? 'play' : 'pause' );
	}
	pauseElt.show();
	
	// arrange for some visualisation
	var channels = handle.GetChannels();
	var currSampleElt = [];
	
	setInterval( function() {
		for( var i = 0; i < channelCount; i++ )
		{
			var pitch = channels[i].GetCurrentPitch();
			var vol = channels[i].GetCurrentVolume();
			var sampleIndex = channels[i].GetCurrentSampleIndex();
			var bgcol = '#fff';

			if (currSampleElt[i])
			{
				currSampleElt[i].style.background = '#fff';
				currSampleElt[i] = null;
			}
			
			if( pitch && vol )
			{
				var g = Math.floor(vol * 15);
				var b = Math.floor(((pitch - 800)/800)*15);
				b = (b<0?0:(b>15?15:b));

				var r = Math.floor(((800 - pitch)/800)*15);
				r = (r<0?0:(r>15?15:r));
				
				bgcol = '#' + r.toString(16) + g.toString(16) + b.toString(16);
				currSampleElt[i]=sampleElts[sampleIndex];
			}
			channelElts[i].style.background = bgcol;

			if (currSampleElt[i])
			{
				currSampleElt[i].style.background = bgcol;
			}

			propThroughElt.width(Math.floor(100 * (handle.GetPos() / handle.GetLength())));
		}
	}, 100 );
}

boot = function()
{
	if( !Mixer.Init() )
	{
		console.log( "Audio init failed!" );
		return;
	}

	if( location.href.indexOf('?') > -1 )
	{
		var file = location.href.substring(location.href.indexOf('?')+1);
		if( file.search(/[^a-zA-Z0-9.]/) == -1 )
		{		
	        $.ajax({
	            url: 'music/' + file,
	            dataType: 'text',
	            success: gotModule
	        });
		}
	}
}
// -------------------
})();
