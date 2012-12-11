var boot = null;
(function(){
// -----------------

function gotModule( data )
{
	var mod = new TrackerModule(data);

	// display some info
	var channelCount = mod.GetChannelCount();
	var text = '';
		
	text += '<div>';
		for( var i = 0; i < channelCount; i++ )
		{
			text += '<span id="ch' + i + '">&nbsp;&nbsp;&nbsp;&nbsp;</span> ';
		}
	text += '</div>';
	
	text += '<pre>';
		text += mod.GetTitle() + ': ' + mod.GetMagic() + "\n";	
		var samples = mod.GetSamples();
		
		for( var i = 1; i < samples.length; i++ )
		{
			text += i + ': ' + samples[i].title + ' / ' + samples[i].len + "\n";
		}
	text += '</pre>';
	$('body').html(text);
	
	var channelElts = [ ];
	for( var i = 0; i < channelCount; i++ )
	{
		channelElts[i] = document.getElementById('ch'+i);
	}
	
	// play the module
	var handle = mod.Play();
	handle.SetVolume( 0.8 );
	
	// arrange for some visualisation
	var channels = handle.GetChannels();
	
	setInterval( function() {
		for( var i = 0; i < channelCount; i++ )
		{
			var pitch = channels[i].GetCurrentPitch();
			var vol = channels[i].GetCurrentVolume();
			var bgcol = 'fff';
			
			if( pitch && vol )
			{
				var g = Math.floor(vol * 15);
				var b = Math.floor(((pitch - 800)/800)*15);
				b = (b<0?0:(b>15?15:b));

				var r = Math.floor(((800 - pitch)/800)*15);
				r = (r<0?0:(r>15?15:r));
				
				bgcol = '#' + r.toString(16) + g.toString(16) + b.toString(16);
			}
			channelElts[i].style.background = bgcol;
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
	            url: file,
	            dataType: 'text',
	            success: gotModule
	        });
		}
	}
}
// -------------------
})();