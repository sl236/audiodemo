function TrackerModule(_base64data)														{if(arguments.length){this.__init__.apply(this,arguments);}};


// -----------------------------------------------------------------------------------------------
(function(){
// -----------------------------------------------------------------------------------------------

var Codec = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function DecodeB64(_b64)
{
	_b64 = _b64.replace((/[^A-Za-z0-9\/\+]/g), '');
	var len = Math.floor(((_b64.length * 6) + 7) / 8);
	var result = new Uint8Array(len);

	var buffer = 0;
	var bits = 0;
	var pos = 0;

	for (var i = 0; i < len; i++)
	{
		while (bits < 8)
		{
			buffer = (buffer << 6) | Codec.indexOf(_b64[pos++]);
			bits += 6;
		}
		result[i] = (buffer >>> (bits - 8)) & 0xFF;
		bits -= 8;
	}

	return result;
}

// -----------------------------------------------------------------------------------------------
var c12throot2 = Math.pow(2, 1 / 12);
var c20divln10 = 20 / Math.log( 10 );

function calcFinetuneRatio( i )
{
	var ft = (i > 7 ? i - 16 : i);
	var adj = Math.pow(c12throot2, -(ft / 8));
	return Math.ceil(1712 * adj);
}

var trackerMagics = 
{
	"M.K.": { samples: 31, channels: 4 },
	"M!K!": { samples: 31, channels: 4 },
	"FLT4": { samples: 31, channels: 4 },
	"FLT8": { samples: 31, channels: 8 }
};

function parseSample( _index, data )
{
	var result = { title: '', len: 0, finetune: 0, volume: 0, repeat_start: 0, repeat_length: 0, pcm: null };

	var pos = 20+((_index-1)*(22+2+1+1+2+2));
	for (var i = 0; (i < 22) && data[pos+i]; ++i)
	{
		result.title += String.fromCharCode(data[pos+i]);
	}
	pos += 22;
	result.len = (data[pos+1] + (data[pos] * 256)) * 2;
	pos += 2;
	result.finetune = calcFinetuneRatio( data[pos] );
	pos += 1;
	result.volume = data[pos]/64;
	pos += 1;
	result.repeat_start = (data[pos+1] + (data[pos] * 256)) * 2;
	pos += 2;
	result.repeat_length = (data[pos+1] + (data[pos] * 256)) * 2;

	return result;
}

function parseFooter( _sampleCount, _data, _force )
{
	var pos = 20+(_sampleCount*(22+2+1+1+2+2));
	var result = { songPositions: 0, patterns: null, magic: '', endPosition: 0 };

	result.magic = String.fromCharCode(_data[pos+1+1+128+0])
				+ String.fromCharCode(_data[pos+1+1+128+1])
				+ String.fromCharCode(_data[pos+1+1+128+2])
				+ String.fromCharCode(_data[pos+1+1+128+3]);
	if( !trackerMagics[result.magic] && !_force )	{ return null; }
	if( !trackerMagics[result.magic] ) { result.magic = ''; }

	result.songPositions = _data[pos];
	if( !result.songPositions && !_force ) { return null; }
	result.patterns = _data.subarray( pos+2, pos+2+128 );
	result.endPosition = pos+2+128+result.magic.length;
	
	return result;
}

function parsePatternData( _data, _channels )
{
	var result = [ ];
	for( var i = 0; i < 1024; i+=4 )
	{
		var b0 = _data[i+0];
		var b1 = _data[i+1];
		var b2 = _data[i+2];
		var b3 = _data[i+3];
		result.push({
			'sample': ((b0 & 0xF0) | ((b2&0xF0)>>4)),
			'param': ((b0&0xF) << 8) | b1,
			'effect': ((b2&0xF) << 8) | b3,
		});
	}
	return result;
}

TrackerModule.prototype.__init__ = function( _base64Data )
{
	var data = DecodeB64( _base64Data );
	this.data = data;

	this.title = '';
	for( var i = 0; (i < 20) && data[i]; ++i )
	{
		this.title += String.fromCharCode(data[i]);
	}

	this.samples = [ { title: '', length: 0, finetune: 0, volume: 0, repeat_start: 0, repeat_length: 0, pcm: null } ];

	var sampleCount = 31;	
	this.footer = parseFooter( 31, data );
	if( !this.footer )
	{
		sampleCount = 15;
		this.footer = parseFooter( 15, data, true );
	}

	for( var i = 1; i <= sampleCount; ++i )
	{
		this.samples[i] = parseSample( i, data );
	}

	var patternCount = 0;
	for( var i = 0; i < 128; ++i )
	{
		patternCount = (patternCount < this.footer.patterns[i]) ? this.footer.patterns[i] : patternCount;
	}
	patternCount++;

	var pos = this.footer.endPosition;
	this.patternData = [ ];
	for( var i = 0; i < patternCount; ++i )
	{
		this.patternData[i] = parsePatternData( data.subarray( pos, pos+1024 ) );
		pos += 1024;
	}

	for( var i = 1; i < this.samples.length; ++i )
	{
		var len = this.samples[i].len;
		var sampledata = data.subarray( pos, pos+len );
		var pcm = new Float32Array( len );
		for( var j = 0; j < len; j++ )
		{
			var s = sampledata[j];
			pcm[j] = (s>127) ? ((s-256)/-128) : (s/127);
		}
		this.samples[i].pcm = pcm;
		pos += len;
	}
}

// -----------------------------------------------------------------------------------------------

function PlaybackCursor(_module)								{ if (arguments.length) { this.__init__.apply(this, arguments); } };

(function(){
var ClockRate = 7093789.2;

// -- 
function Channel() 
{
	this.m_data = null;
	this.m_loopStart = 0;
	this.m_loopEnd = 0;
	this.m_repeated = 0;
	this.m_period = 0;
	this.m_volume = 0;
	this.m_pos = 0;
	this.m_clocks = 0;
}

Channel.prototype.Play = function( _sampleData, _volume, _period )
{
	if( !_sampleData )
	{
		this.m_data = null;
		return;
	}

	//var result = { title: '', len: 0, finetune: 0, volume: 0, repeat_start: 0, repeat_length: 0, pcm: null };
	this.m_data = _sampleData.pcm;
	this.m_loopStart = _sampleData.repeat_start;
	this.m_loopEnd = _sampleData.repeat_length ? (_sampleData.repeat_start + _sampleData.repeat_length) : 0;
	this.m_repeated = 0;
	this.m_period = _period * _sampleData.finetune;
	this.m_volume = _sampleData.volume * _volume;
	this.m_pos = 0;
	this.m_clocks = 0;	
}

Channel.prototype.Mix = function( _dest, _start, _len, _destPeriod )
{
	var data = this.m_data;
	if (!data) { return; }

	var dpos = _start;
	var dend = _start + _len;
	var spos = this.m_pos;
	var sclocks = this.m_clocks;
	var send = this.m_repeated ? this.m_loopEnd : data.length;
	var period = this.m_period;
	var destPeriod = _destPeriod;
	var loopData = this.m_loopEnd ? data[this.m_loopStart] : 0;

	while( dpos < dend )
	{
		var csample = data[spos];
		var nsample = ((spos+1)<send) ? data[spos+1] : loopData;

		while( ( sclocks < period ) && ( dpos < dend ) )
		{
			var prop = (sclocks/period);
			_dest[dpos++] = prop * nsample + (1-prop) * csample;
			sclocks += destPeriod;
		}

		if( sclocks >= period )
		{
			sclocks -= period;
			++spos;
			if (spos == send)
			{
				if (!this.m_loopEnd)
				{
					this.m_data = null;
					return;
				}
				spos = this.m_loopStart;
				this.m_repeated = 1;
			}
		}
	}
	this.m_pos = spos;
	this.m_clocks = sclocks;
}

// -- 

PlaybackCursor.prototype.__init__ = function( _module )
{
	this.m_mod = _module;
	this.m_channels = [ ];
	this.m_playing = 0;
	this.m_volume = 1;

	this.m_ticksPerDivision = 6;
	this.m_divisionsPerSecond = 125*4/60;
	
	this.m_pos = 0;
	this.m_div = 0;
	this.m_samples = 0;
}

// AS interface
// onStart( _mixer )
// onFinish( _mixer )
// GetLength()
// GetPos()
// GetLeft()
// Render( _dest, _start, _len )
// SetVolume( _volume )
PlaybackCursor.prototype.onStart = function( _mixer )	{ }
PlaybackCursor.prototype.onFinish = function( _mixer )	{ }
PlaybackCursor.prototype.GetLength = function()			{ return this.m_playing ? (Mixer.BufferLength * 2) : 0; }
PlaybackCursor.prototype.GetPos = function()			{ return 0; }
PlaybackCursor.prototype.GetLeft = function()			{ return this.m_playing ? (Mixer.BufferLength * 2) : 0; }
PlaybackCursor.prototype.SetVolume = function( _volume ){ this.m_volume = _volume; }
PlaybackCursor.prototype.Render = function( _dest, _start, _len )
{
	var destPeriod = ClockRate / Mixer.SampleRate;

	var end = _start + _len;
	for( var i = _start; i < end; ++i )
	{
		_dest[i] = 0;
	}

	var pos = this.m_pos;
	var div = this.m_div;
	var samples = this.m_samples;

	var dpos = _start;
	while( dpos < end )
	{
		// calculate length of current division
		// calculate length of render run
		// mix division channels into _dest
		// advance pos/div/samples/dpos
	}

	this.m_pos = pos;
	this.m_div = div;
	this.m_samples = samples;
}

})();

// -----------------------------------------------------------------------------------------------
})();
// -----------------------------------------------------------------------------------------------