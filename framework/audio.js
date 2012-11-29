var Mixer = 
{
	Init: function() {},
	SampleRate: 0,
	Channels: 1,
	BufferLength: 8192
};

// ---------------------------------------------
(function(){

// ----
var webAudioContext = null;
var webAudioContextJSNode = null;
var mozAudio = null;
var mozAudioBuffers = [];
var mozAudioSampleOffset = [ 0, 0, 0, 0, 0, 0, 0, 0 ];

// ----
function mix_channel( channel, dest )
{
	var len = dest.length;
	for(var i = 0; i < len; i++)
	{
		
	}
}

// ----
Mixer.Init = function()
{
	try
	{
		webAudioContext = new webkitAudioContext();
		Mixer.SampleRate = webAudioContext.sampleRate;
		webAudioContext.destination.numberOfChannels = Mixer.Channels;
		webAudioContextJSNode = webAudioContext.createJavaScriptNode(Mixer.BufferLength, 0, Mixer.Channels);
		webAudioContextJSNode.onaudioprocess = function(e)
		{
			for( var i = 0; i < Mixer.Channels; ++i )
			{
				mix_channel(i, e.outputBuffer.getChannelData(i));
			}
		};		
		webAudioContextJSNode.connect(webAudioContext.destination);
	}
	catch (e) 
	{ 
		webAudioContext = null;
		webAudioContextJSNode = null;
	}

	if(!webAudioContext)
	{
		Mixer.SampleRate = 22050;
		try
		{
			for (var j = 0; j < Mixer.Channels; ++j)
			{
				mozAudioBuffers.push(new Float32Array(Mixer.BufferLength));
			}
			mozAudio = new Audio();
			mozAudio.mozSetup( Mixer.Channels, Mixer.SampleRate );

			setInterval( function() 
			{		
				for( var channel = 0; channel < Mixer.Channels; channel++ )
				{
					var ofs = mozAudioSampleOffset[channel];
					ofs += mozAudio.mozWriteAudio( mozAudioBuffers[channel].subarray(ofs) );
					if( ofs >= Mixer.BufferLength )
					{
						mix_channel( channel, mozAudioBuffers[channel] );
						ofs = mozAudio.mozWriteAudio( mozAudioBuffers[channel] );
					}
				}
			}, Math.floor(Mixer.BufferLength * 500 / Mixer.SampleRate) );
		}
		catch( e )
		{
		}
	}
}



})();
// ---------------------------------------------