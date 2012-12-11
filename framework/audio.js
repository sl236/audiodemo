// js.audiodemo - Sergei Lewis 2012
// Distributed under the Do Whatever You Want license:
// 1. You just do whatever you want.
//
// https://github.com/sl236/audiodemo/

var Mixer = 
{
	Init: function()													{},
	SetVolume:	function( volume )										{},
	Queue_Audio: function( handle, delay )								{},

	SampleRate: 0,
	Channels: 1,
	BufferLength: 4096
};

var Synthesizer = 
{
	SetBaseDuration: 	function( sec )												{},
	SetTrackInstrument:	function( track, instrument )								{},
	SetTrackVolume:		function( track, volume )									{},
	
	Instruments:
		{			
			Sine: {},
			Glock: {},
			Piano: {},
		},
	
	QueueTracks: 		function()													{},

	CalcEqualTuningFrequency:	function( note )									{},
	MakeSineWaveHandle:			function( note )									{},
	ApplyADSR:					function( handle, ADSR )							{}
};


// Audio sources
function AS_PCM( pcm )																{if(arguments.length){this.__init__.apply(this,arguments);}};
function AS_SineWave( freq, lengthSamples, phase )									{if(arguments.length){this.__init__.apply(this,arguments);}};

// Audio filters
function Filter_ADSR( handle, Aprop, Dprop, Svol, Rprop )							{if(arguments.length){this.__init__.apply(this,arguments);}};
function Filter_Mix()																{if(arguments.length){this.__init__.apply(this,arguments);}};

// ---------------------------------------------
(function(){

// ----
var webAudioContext = null;
var webAudioContextJSNode = null;
var mozAudio = null;
var mozAudioBuffer = null;
var mozAS_PCMOffset = 0;

var master_mixer = null;

// AS interface
// onStart( _mixer )
// onFinish( _mixer )
// GetLength()
// GetPos()
// GetLeft()
// Render( _dest, _start, _len )
// SetVolume( _volume )

// ----
AS_PCM.prototype.__init__ = function( data )
{
	this.m_data = data;
	this.m_pos = 0;
	this.m_volume = 1;
}

AS_PCM.prototype.onStart = function( _mixer )
{
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
	return this.GetLength() - this.GetPos();
}

AS_PCM.prototype.Render = function( _dest, _start, _len )
{
	var pos = this.m_pos;	
	var dpos = _start;
	
	var len = this.GetLeft();
	var dend = dpos + ((_len < len) ? _len : len);
	
	var volume = this.m_volume;
	var data = this.m_data;
		
	for( ; dpos < dend; dpos++ )
	{
		_dest[dpos] = data[pos++] * volume;
	}
	
	dend = _start + _len;
	for( ; dpos < dend; dpos++ )
	{
		_dest[dpos] = 0;
	}
	
	this.m_pos = pos;
}

AS_PCM.prototype.SetVolume = function(_volume)
{
	this.m_volume = _volume;
}

AS_PCM.prototype.onFinish = function( _mixer )
{

}


// ----
AS_SineWave.prototype.__init__ = function(freq, duration, phase)
{
	this.m_factor = (freq * 2 * Math.PI) / Mixer.SampleRate;
	this.m_pos = phase || 0;
	this.m_length = duration + this.m_pos;
	this.m_volume = 1;
}

AS_SineWave.prototype.onStart = AS_PCM.prototype.onStart;
AS_SineWave.prototype.GetLeft = AS_PCM.prototype.GetLeft;
AS_SineWave.prototype.GetPos = AS_PCM.prototype.GetPos;
AS_SineWave.prototype.SetVolume = AS_PCM.prototype.SetVolume;
AS_SineWave.prototype.onFinish = AS_PCM.prototype.onFinish;

AS_SineWave.prototype.GetLength = function()
{
	return this.m_length;
}

AS_SineWave.prototype.Render = function( _dest, _start, _len )
{
	var end = _start + ((_len <= this.GetLeft()) ? _len : this.GetLeft());
	var volume = this.m_volume;
	var pos = this.m_pos;
	var factor = this.m_factor;
	var dpos = _start;
	for( ; dpos < end; dpos++ )
	{
		_dest[dpos] = Math.sin( (pos++) * factor ) * volume;
	}
	for( ; dpos < _len; dpos++ )
	{
		_dest[dpos] = 0;
	}
	this.m_pos = pos;
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
Filter_ADSR.prototype.GetLeft = function(){ return this.m_src.GetLeft(); };
Filter_ADSR.prototype.GetPos = function(){ return this.m_src.GetPos(); };
Filter_ADSR.prototype.GetLength = function() { return this.m_src.GetLength(); };
Filter_ADSR.prototype.onFinish = function() { this.m_src.onFinish(); };
Filter_ADSR.prototype.SetVolume = function(_volume) { this.m_src.SetVolume(_volume); }

Filter_ADSR.prototype.Render = function( _dest, _start, _len )
{
	var length = this.m_src.GetLength();
	var Aendf = this.m_Aend;
	var Dendf = this.m_Dend;
	var Sendf = this.m_Send;
	var Aend = Math.floor(length * Aendf);
	var Dend = Math.floor(length * Dendf);
	var Send = Math.floor(length * Sendf);
	
	var pos = this.m_src.GetPos();
	var end = pos + _len;
	end = (length < end) ? length : end;
	
	this.m_src.Render( _dest, _start, _len );
	
	Aend = (end < Aend) ? end : Aend;
	Dend = (end < Dend) ? end : Dend;
	Send = (end < Send) ? end : Send;
	
	var dpos = _start;

	for(  ; pos < Aend; pos++ )
	{		
		_dest[dpos++] *= (pos/length) / Aendf;
	}
	
	var Dlen = this.m_Dlen;
	var Svol = this.m_Svol;
	for(  ; pos < Dend; pos++ )
	{		
		_dest[dpos++] *= (1-(((pos/length) - Aendf) / Dlen)) * (1-Svol) + Svol;
	}
	
	for(  ; pos < Send; pos++ )
	{
		_dest[dpos++] *= Svol;
	}
	
	var Rlen = this.m_Rlen;
	for(  ; pos < end; pos++ )
	{
		_dest[dpos++] *= (1-(((pos/length) - Sendf) / Rlen)) * Svol;
	}	
}

// ----

// ----
Filter_Mix.prototype.__init__ = function()
{
	this.m_sources = arguments;
	
	this.m_active = [ ];
	this.m_pending = [ ];
	for( var i = 0; i < arguments.length; i++ )
	{
		if( arguments[i] )
		{
			this.m_pending.push( arguments[i].length ? arguments[i] : [0, arguments[i]] );
		}
	}
	this.m_pending.sort(function(a, b) { return a[0] - b[0]; });
		
	this.m_length = 0;
	this.m_pos = 0;
	this.m_volume = 1;
	
	for( var i = 0; i < this.m_pending.length; i++ )
	{
		var len =  this.m_pending[i][0] + this.m_pending[i][1].GetLength();
		this.m_length = (len > this.m_length) ? len : this.m_length;
	}
}

Filter_Mix.prototype.onStart = function(){ };
Filter_Mix.prototype.GetLeft = function(){ return this.m_length - this.m_pos; };
Filter_Mix.prototype.GetPos = function(){ return this.m_pos; };
Filter_Mix.prototype.GetLength = function() { return this.m_length; };
Filter_Mix.prototype.onFinish = function() { };
Filter_Mix.prototype.SetVolume = function(_volume) { this.m_volume = _volume; }

Filter_Mix.prototype.Queue_Audio = function(handle, delay)
{
	this.m_pending.push([ this.m_pos + (delay||0), handle ]);
	this.m_pending.sort(function(a, b) { return a[0] - b[0]; });

	var len = (delay||0) + handle.GetLength();
	this.m_length = ( len > this.m_length ) ? len : this.m_length;
	
	return handle;
}

Filter_Mix.prototype.Render = function( dest, _start, _len )
{
	if( (!this.m_tmp) || (this.m_tmp.length < (_start+_len)) )
	{
		this.m_tmp = new Float32Array( _start+_len );
	}
	
	var pos = this.m_pos;
	var end = pos + _len;
	
	var dpos = _start;
	var temp = this.m_tmp;
	
	var pending = this.m_pending;
	var active = this.m_active;

	var dend = dpos + _len;
	for( var i = dpos; i < dend; i++ )
	{
		dest[i] = 0;
	}
	
	while( pos < end )
	{
		if( pending.length && (pending[0][0] <= pos ) )
		{
			do
			{
				var obj = (pending.shift())[1];
				obj.onStart( this );
				active.push( obj );
			} while( pending.length && (pending[0][0] <= pos ) );

			active.sort( function(a,b) { return a.GetLeft() - b.GetLeft(); } );
		}

		var runlength = (end-pos);
		var lenToPending = pending.length ? (pending[0][0] - pos) : runlength;
		var lenToEndOfActive = active.length ? active[0].GetLeft() : runlength;
		runlength = (lenToPending < runlength) ? lenToPending : runlength;
		runlength = (lenToEndOfActive < runlength) ? lenToEndOfActive : runlength;
		destrunend = dpos + runlength;
				
		pos += runlength;
		this.m_pos = pos;
		
		if( active.length )
		{
			for( var source = 0; source < active.length; source++ )
			{
				active[source].Render( temp, dpos, runlength );
				for( var i = dpos; i < destrunend; i++ )
				{
					dest[i] += temp[i];
				}
			}
			
			var volume = this.m_volume;
			for( var i = dpos; i < destrunend; i++ )
			{
				dest[i] *= volume;
			}

			while( active.length && (active[0].GetLeft() <= 0) )
			{
				active.shift().onFinish(this);
			}				
		}
		
		dpos += runlength;	
	}

	if( active.length || pending.length )
	{	
		this.m_pos = pos;
	}
	else
	{
		this.m_pos = 0;
		this.m_length = 0;
	}
}

// ----
Mixer.Queue_Audio = function( handle, delay )
{
	return master_mixer.Queue_Audio( handle, delay );
}

Mixer.SetVolume = function( volume )
{
	master_mixer.SetVolume( volume );
}

// ----
Mixer.Init = function()
{
	var ok = 0;
	Mixer.Channels = 1;
	
	master_mixer = new Filter_Mix( null );

	try
	{
		currentMixSample = 0;
		webAudioContext = webAudioContext || (new webkitAudioContext());
		Mixer.SampleRate = webAudioContext.sampleRate;
		webAudioContext.destination.numberOfChannels = Mixer.Channels;
		webAudioContextJSNode = webAudioContextJSNode || webAudioContext.createJavaScriptNode(Mixer.BufferLength, 0, Mixer.Channels);
		webAudioContextJSNode.onaudioprocess = function(e)
		{
			var dest = e.outputBuffer.getChannelData(0);
			master_mixer.Render( dest, 0, dest.length );
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
				
				master_mixer.Render( mozAudioBuffer, 0, mozAudioBuffer.length );

				setInterval( function() 
				{		
					var ofs = mozAS_PCMOffset;
					var len = mozAudio.mozWriteAudio( mozAudioBuffer.subarray(ofs) );										
					
					master_mixer.Render( mozAudioBuffer, ofs, len );
					ofs += len;
					
					if( ofs >= Mixer.BufferLength )
					{
						ofs = 0;
						len = mozAudio.mozWriteAudio( mozAudioBuffer.subarray(ofs) );
						
						master_mixer.Render( mozAudioBuffer, ofs, len );
						ofs += len;
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
	
	if( !ok )
	{
		master_mixer = 
		{
			Queue_Audio: function() {},
			SetVolume: function() {},		
		};
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
var instruments = [];
var volumes = [];
var defaultInstrument = null;

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

Synthesizer.SetTrackInstrument = function( track, desc )
{
	instruments[track] = desc;
}

Synthesizer.SetTrackVolume = function( track, volume )
{
	while( volumes.length < track )
	{
		volumes.push(1);
	}
	volumes[track] = volume;
}

Synthesizer.CalcEqualTuningFrequency = function( desc )
{
	return (440 * freqRatio( desc.id, A4 ));
}

Synthesizer.MakeSineWaveHandle = function( desc )
{
	var freq = desc.freq || Synthesizer.CalcEqualTuningFrequency(desc);
	return new AS_SineWave( freq, desc.len, desc.phase );
}

Synthesizer.ApplyADSR = function( handle, adsr )
{
	return new Filter_ADSR( handle, adsr[0], adsr[1], adsr[2], adsr[3] )
}

function TriggerNote(track, note)
{
	var instrument = instruments[track] || defaultInstrument;
	instrument.Play( note, volumes[track] );
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
	
	while( volumes.length < tracks.length )
	{
		volumes.push(1);
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
					TriggerNote( i, open[i] );
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
			TriggerNote( i, open[i] );
		}
	}
}

// ---

Synthesizer.Instruments.Sine = (function(){
	var ADSR = [ 0.05, 0, 1, 0.05 ];
	
return {
	Name: 'Sine',
	'ADSR': ADSR,
	Play: function( note, volume )
	{
		var handle = Synthesizer.MakeSineWaveHandle( note );
		handle.SetVolume( volume );
		Mixer.Queue_Audio( Synthesizer.ApplyADSR( handle, ADSR ), note.start );
	}
};
})();

Synthesizer.Instruments.Glock = (function(){
	var ADSR = [ 0.02, 0.1, 0.4, 0.4 ];
	
	var cache = [ ];

return {
	Name: 'Glock',
	'ADSR': ADSR,
	Play: function( note, volume )
	{
		var tag = note.id + '/' + note.len + '/' + ADSR[0] + '/' + ADSR[1] + '/' + ADSR[2] + '/' + ADSR[3];
		
		if( !cache[tag] )
		{			
			var mix = new Filter_Mix( null );
			var freq = note.freq;
			for( var i = 0; i < 5; i++ )
			{
				note.freq = freq * Math.pow( 2, i );
				var handle = Synthesizer.MakeSineWaveHandle( note );
				handle.SetVolume( Math.pow(2,-i) );
				mix.Queue_Audio( handle, 0 );
			}
			mix = Synthesizer.ApplyADSR( mix, ADSR );
			cache[tag] = new Float32Array( mix.GetLength() );
			mix.Render( cache[tag], 0, mix.GetLength() );
		}
		
		var handle = new AS_PCM( cache[tag] );
		handle.SetVolume( volume );
		
		Mixer.Queue_Audio( handle, note.start );
	}
};
})();

Synthesizer.Instruments.Pipe = (function(){
	var ADSR = [ 0.2, 0.3, 0.5, 0.01 ];
	
	var cache = [ ];

return {
	Name: 'Pipe',
	'ADSR': ADSR,
	Play: function( note, volume )
	{
		var tag = note.id + '/' + note.len + '/' + ADSR[0] + '/' + ADSR[1] + '/' + ADSR[2] + '/' + ADSR[3];
		
		if( !cache[tag] )
		{			
			var mix = new Filter_Mix( null );
			var freq = note.freq;
			for( var i = 0; i < 5; i++ )
			{
				note.freq = freq * Math.pow( 3, i );
				var handle = Synthesizer.MakeSineWaveHandle( note );
				handle.SetVolume( Math.pow(2, -(i+2)) );
				mix.Queue_Audio( handle, 0 );
			}
			
			mix = Synthesizer.ApplyADSR( mix, ADSR );
			cache[tag] = new Float32Array( mix.GetLength() );
			mix.Render( cache[tag], 0, mix.GetLength() );
		}
		
		var handle = new AS_PCM( cache[tag] );
		handle.SetVolume( volume );
		
		Mixer.Queue_Audio( handle, note.start );
	}
};
})();


defaultInstrument = Synthesizer.Instruments.Glock;


})();
// ---------------------------------------------
