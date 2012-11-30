var Mixer = 
{
	Init: function()													{},
	Queue_Audio: function( handle )										{},

	SampleRate: 0,
	Channels: 1,
	BufferLength: 1024
};

var Synthesizer = 
{
	SetBaseDuration: 	function( sec )												{},
	SetADSR: 			function( track, A, D, S, R )								{},
	TriggerNote: 		function( track, note )										{},
	QueueTracks: 		function()													{},
};


// Audio sources
function AS_PCM( pcm, delaySamples )											{if(arguments.length){this.__init__.apply(this,arguments);}};
function AS_SineWave( freq, lengthSamples, delaySamples )						{if(arguments.length){this.__init__.apply(this,arguments);}};

// Audio filters
function Filter_ADSR( handle, Aprop, Dprop, Svol, Rprop )						{if(arguments.length){this.__init__.apply(this,arguments);}};

// ---------------------------------------------
(function(){

// ----
var webAudioContext = null;
var webAudioContextJSNode = null;
var mozAudio = null;
var mozAudioBuffer = null;
var mozAS_PCMOffset = 0;

var currentMixSample = 0;
var active = [];
var pending = [];

// ----
function mix_channel( dest )
{
	var len = dest.length;	
	var start = currentMixSample;
	var pos = 0;
	while( pos < len )
	{
		if( pending.length && (pending[0].GetStart() <= (pos + start) ) )
		{
			do
			{
				var obj = pending.shift();
				obj.onStart();
				active.push( obj );
			} while( pending.length && (pending[0].GetStart() <= (pos + start) ) );

			active.sort( function(a,b) { return a.GetLeft() - b.GetLeft(); } );
		}

		var runlength = (len-pos);
		var lenToPending = pending.length ? (pending[0].m_start - (pos + start)) : runlength;
		var lenToEndOfActive = active.length ? active[0].GetLeft() : runlength;
		runlength = (lenToPending < runlength) ? lenToPending : runlength;
		runlength = (lenToEndOfActive < runlength) ? lenToEndOfActive : runlength;
		runend = pos + runlength;
		
		for( var i = pos; i < runend; i++ )
		{
			dest[i] = 0;
		}
		
		if( active.length )
		{
			for( var source = 0; source < active.length; source++ )
			{
				var buf = active[source];
				for( var i = 0; i < runlength; i++ )
				{
					dest[pos+i] += buf.Sample();
				}
			} 

			currentMixSample = runend + start;
			while( active.length && (active[0].GetLeft() <= 0) )
			{
				active.shift().onFinish();
			}
		}
		
		pos = runend;
	}

	currentMixSample = (active.length || pending.length ) ? len + start : 0;
}

// ----
AS_PCM.prototype.__init__ = function( data, delay )
{
	this.m_data = data;
	this.m_start = delay + currentMixSample;
	this.m_pos = 0;
	this.m_length = data.length;
}

AS_PCM.prototype.onStart = function()
{
	this.m_pos = currentMixSample - this.m_start;
}

AS_PCM.prototype.GetStart = function()
{
	return this.m_start;
}

AS_PCM.prototype.GetLength = function()
{
	return this.m_data.length;
}

AS_PCM.prototype.GetPos = function()
{
	return this.m_pos;
}

AS_PCM.prototype.GetLeft = function()
{
	return this.m_length - this.m_pos;
}

AS_PCM.prototype.Sample = function()
{
	return this.m_data[this.m_pos++];
}

AS_PCM.prototype.onFinish = function()
{

}


// ----
AS_SineWave.prototype.__init__ = function(freq, duration, delay)
{
	this.m_factor = (freq * 2 * Math.PI) / Mixer.SampleRate;
	this.m_start = delay + currentMixSample;
	this.m_pos = 0;
	this.m_length = duration;
}

AS_SineWave.prototype.onStart = AS_PCM.prototype.onStart;
AS_SineWave.prototype.GetStart = AS_PCM.prototype.GetStart;
AS_SineWave.prototype.GetLeft = AS_PCM.prototype.GetLeft;
AS_SineWave.prototype.GetPos = AS_PCM.prototype.GetPos;
AS_SineWave.prototype.onFinish = AS_PCM.prototype.onFinish;

AS_SineWave.prototype.GetLength = function()
{
	return this.m_length;
}

AS_SineWave.prototype.Sample = function()
{
	var p = this.m_pos++;
	return Math.sin( p * this.m_factor );
}

// ----
Filter_ADSR.prototype.__init__ = function( handle, Alen, Dlen, Svol, Rlen )
{
	this.m_src = handle;
	this.m_Aend = Alen;
	this.m_Dlen = Dlen;
	this.m_Dend = Dlen + Alen;
	this.m_Svol = Svol;
	this.m_Send = 1 - Rlen;
	this.m_Rlen = Rlen;
}

Filter_ADSR.prototype.onStart = function(){ this.m_src.onStart(); };
Filter_ADSR.prototype.GetStart = function(){ return this.m_src.GetStart(); };
Filter_ADSR.prototype.GetLeft = function(){ return this.m_src.GetLeft(); };
Filter_ADSR.prototype.GetPos = function(){ return this.m_src.GetPos(); };
Filter_ADSR.prototype.GetLength = function() { return this.m_src.GetLength(); };
Filter_ADSR.prototype.onFinish = function() { this.m_src.onFinish(); };

Filter_ADSR.prototype.Sample = function()
{
	var pos = (this.m_src.GetPos() / this.m_src.GetLength());
	pos = (pos < 0) ? 0 : ((pos > 1) ? 1 : pos);
	var sample = this.m_src.Sample();
	
	if( pos <= this.m_Aend )
	{
		sample *= (pos / this.m_Aend);
	}
    else if( pos <= this.m_Dend )
	{
		sample *= (1-((pos - this.m_Aend) / this.m_Dlen)) * (1-this.m_Svol) + this.m_Svol;
	} 
	else if( pos <= this.m_Send )
	{
		sample *= this.m_Svol;
	}
	else
	{
		sample *= (1-((pos - this.m_Send) / this.m_Rlen)) * this.m_Svol;
	}
	return sample;
}


// ----
Mixer.Queue_Audio = function( handle )
{
	pending.push(handle);
	pending.sort(function(a, b) { return a.m_start - b.m_start; });
	return handle;
}

// ----
Mixer.Init = function()
{
	var ok = 0;
	Mixer.Channels = 1;

	try
	{
		currentMixSample = 0;
		webAudioContext = webAudioContext || (new webkitAudioContext());
		Mixer.SampleRate = webAudioContext.sampleRate;
		webAudioContext.destination.numberOfChannels = Mixer.Channels;
		webAudioContextJSNode = webAudioContextJSNode || webAudioContext.createJavaScriptNode(Mixer.BufferLength, 0, Mixer.Channels);
		webAudioContextJSNode.onaudioprocess = function(e)
		{
			mix_channel(e.outputBuffer.getChannelData(0));
		};		
		webAudioContextJSNode.connect(webAudioContext.destination);
		ok = 1;
	}
	catch (e) 
	{ 
		ok = 0;
	}

	if(!ok)
	{
		Mixer.SampleRate = 44100;
		try
		{
			mozAudioBuffer = new Float32Array(Mixer.BufferLength);
			if( !mozAudio )
			{
				mozAudio = new Audio();
				mozAudio.mozSetup( Mixer.Channels, Mixer.SampleRate );

				setInterval( function() 
				{		
					var ofs = mozAS_PCMOffset;
					ofs += mozAudio.mozWriteAudio( mozAudioBuffer.subarray(ofs) );
					if( ofs >= Mixer.BufferLength )
					{
						mix_channel( mozAudioBuffer );
						ofs = mozAudio.mozWriteAudio( mozAudioBuffer );
					}
					mozAS_PCMOffset = ofs;
				}, Math.floor(Mixer.BufferLength * 250 / Mixer.SampleRate) );
			}
			ok = 1;
		}
		catch( e )
		{
			ok = 0;
		}
	}

	return ok;
}
})();
// ---------------------------------------------

// ---------------------------------------------
(function(){

var baseLength = 0;
var c12throot2 = Math.pow(2, 1/12);
var octaveCodes = { "0" : 0, "1" : 1, "2" : 2, "3" : 3, "." : 3, "4" : 4, " " : 4, "-" : 4, "5" : 5, "'" : 5, "6" : 6, "7" : 7, "8" : 8 };
var A4 = parseNote( 'A4' );
var ADSR = [];
var defaultADSR = [ 0.3, 0.2, 0.6, 0.3 ];

function parseNote( text )
{
	var note = text.charAt(0).toUpperCase();
	var id = '-C-D-EF-G-A-B'.indexOf(note);
	if( id < 0 ) { return 0; }
	var sharp = (note != text.charAt(0)) ? 1 : 0;
	var octave = octaveCodes[text.charAt(1)] || 0;
	return (octave*12) + id + sharp;		
}

function freqRatio( nid1, nid2 )
{
	return Math.pow( c12throot2, nid1 - nid2 );
}
	
// ----

function tnorm( tracks )
{
	var l = 0;
	for( var i = 0; i < tracks.length; i++ )
	{
		if( l < tracks[i].length ) { l = tracks[i].length; }
	}
	for( var i = 0; i < tracks.length; i++ )
	{
		while( tracks[i].length < l )
		{
			tracks[i] += ' ';
		}
	}
	return l;
}

function tsplice()
{
	var result = [];
			
	for( var i = 0; i < arguments.length; i++ )
	{
		var t = arguments[i];
		var l = tnorm(result);
		
		for( var j = 0; j < t.length; j++ )
		{
			if( result.length <= j )
			{
				var nt = '';
				for( var k = 0; k < l; k++ )
				{
					nt += ' ';
				}
				result[j] = nt;
			}
			
			result[j] += t[j];
		}
	}
	
	tnorm(result);
	return result;
}

// --	

Synthesizer.SetBaseDuration = function(sec)
{
	baseLength = Math.floor(sec * Mixer.SampleRate);
}

Synthesizer.SetADSR = function( track, A, D, S, R )
{
	ADSR[track] = [ A, D, S, R ];
}

Synthesizer.TriggerNote = function(track, desc)
{
	var freq = 440 * freqRatio( desc.id, A4 );
	var adsr = ADSR[track] || defaultADSR;
	Mixer.Queue_Audio( new Filter_ADSR( new AS_SineWave( freq, desc.len, desc.start ), adsr[0], adsr[1], adsr[2], adsr[3] ) );
}

Synthesizer.QueueTracks = function()
{
	var tracks = tsplice.apply(this,arguments);
	if( !baseLength )
	{
		Synthesizer.SetBaseDuration(1/8);
	}
	
	var debug = '<pre>';
	for( var i = 0; i < tracks.length; i++ ) 
	{ 
		debug += tracks[i] + "\n";
	}
	debug += '</pre>';
	$('body').html(debug);
	
	var pos = 0;
	var open = [];
	for( var i = 0; i < tracks.length; i++ )
	{
		open[i] = null;
	}

	for( var j = 0; j < tracks[0].length / 2; j++ )
	{
		for( var i = 0; i < tracks.length; i++ )
		{
			var note = tracks[i].substr(j*2, 2);
			if( note.charAt(0) == '-' )
			{
				if( open[i] )
				{
					open[i].len += baseLength;
				}
			}
			else
			{
				if( open[i] ) 
				{ 
					Synthesizer.TriggerNote( i, open[i] );
					open[i] = null;
				}
				
				var id = parseNote( note );
				if( id )
				{					
					open[i] = { 'id': id, 'len': baseLength, 'start': pos }
				}
			}
		}
		pos += baseLength;
	}
	
	for( var i = 0; i < tracks.length; i++ )
	{
		if( open[i] ) 
		{ 
			Synthesizer.TriggerNote( i, open[i] );
		}
	}
}


})();
// ---------------------------------------------