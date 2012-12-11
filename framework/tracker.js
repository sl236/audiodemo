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
	return Math.ceil(adj);
}

var trackerMagics = 
{
	"M.K.": { samples: 31, channels: 4 },
	"M!K!": { samples: 31, channels: 4 },
	"FLT4": { samples: 31, channels: 4 },
	"4CHN": { samples: 31, channels: 4 },
	"FLT8": { samples: 31, channels: 8 },
	"8CHN": { samples: 31, channels: 8 },
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
		var effect = ((b2&0xF) << 8) | b3;
		result.push({
			'sample': ((b0 & 0xF0) | ((b2&0xF0)>>4)),
			'param': ((b0&0xF) << 8) | b1,
			'effect': (effect>>8)&0xF,
			'X': (effect>>4)&0xF,
			'Y': (effect)&0xF,
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
			pcm[j] = (s>127) ? ((s-256)/128) : (s/127);
		}
		this.samples[i].pcm = pcm;
		pos += len;
	}

	this.channelCount = trackerMagics[this.footer.magic] ? trackerMagics[this.footer.magic].channels : 4;
	this.m_infinite = 0;
	this.m_playTime = 0;
	this.m_keys = [ ];

	// calculate piece length and key list
	(function(){
		var time = 0;
		
		var pos = 0;
		var div = 0;
		var bpm = 125;
		var tickRate = 6;
		var channelCount = this.channelCount;
		var loopmap = [];
		var keys = this.m_keys;

		while( pos < this.footer.songPositions )
		{
			var patternIndex = this.footer.patterns[pos];
			var divisionData = this.patternData[patternIndex];
			var nextdiv = div + channelCount;
			var nextpos = pos;
				
			for( var i = 0; i < channelCount; i++ )
			{
				var ddat = divisionData[div+i];
				switch( ddat.effect )
				{
					case 0xB:	// jump to order
							nextpos = ddat.X * 16 + ddat.Y;
							nextdiv = 0;
						break;
						
					case 0xD:	// pattern break
							nextpos = pos + 1;
							nextdiv = ddat.X * 10 + ddat.Y;
						break;

					case 0xF:	// set speed
							var z = ddat.X * 16 + ddat.Y;
							if( z<=32 )
							{
								tickRate = z;
							}
							else
							{
								bpm = z;
							}							
						break;

				}
			}

			var key = (pos*1024)+div;
			if( loopmap[key] ) // detect infinite loops
			{
				this.m_infinite = true;
				this.m_playTime = time;
				return;
			}

			keys.push( {'time': time, 'pos': pos, 'div': div, 'bpm': bpm, 'tickRate': tickRate } );
			loopmap[key] = 1;
			time += 1 / ( (6/tickRate) * (bpm*4/60) );

			div = nextdiv;
			if( div >= 64*4 )
			{
				nextpos = pos + 1;
				div = 0;
			}
			pos = nextpos;
		};
		this.m_playTime = time;
	}).apply(this);	
}

TrackerModule.prototype.GetPlayTime = function()
{
	return this.m_playTime;
}

TrackerModule.prototype.GetChannelCount = function()
{
	return this.channelCount;
}

TrackerModule.prototype.GetTitle = function()
{
	return this.title;
}

TrackerModule.prototype.GetMagic = function()
{
	return this.footer.magic;
}

TrackerModule.prototype.GetSamples = function()
{
	return this.samples;
}

// -----------------------------------------------------------------------------------------------
function TrackerPlaybackCursor(_module)													{if(arguments.length){this.__init__.apply(this, arguments);}};

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
	this.m_arpeggio = 0;
	this.m_channelVolume = 0.5;
	this.m_sampleVolume = 0;
	this.m_pos = 0;
	this.m_clocks = 0;
}

Channel.prototype.GetCurrentPitch = function()
{
	return this.m_data ? this.m_period : 0;
}

Channel.prototype.GetCurrentVolume = function()
{
	return this.m_data ? this.m_sampleVolume * this.m_channelVolume : 0;
}

Channel.prototype.SetVolume = function( _volume )
{
	this.m_channelVolume = _volume;
}

Channel.prototype.Play = function( _data, _bank )
{
	// sample param effect X Y
	var sampleIdx = _data.sample;
	this.m_effect = _data.effect;
	this.m_effectX = _data.X;
	this.m_effectY = _data.Y;
	
	if( _data.param )
	{
		switch( this.m_effect )
		{
			case 3:
			case 5:
					this.m_slideToNote = _data.param * 2;
					if( _bank[sampleIdx] )
					{
						this.m_slideToNote *= _bank[sampleIdx].finetune;
					}
				break;
	
			default:
				{
					this.m_repeated = 0;
					this.m_arpeggioAdjust = 0;
					this.m_basePeriod = _data.param * 2;
					this.m_pos = 0;
					this.m_clocks = 0;
					
					var sampleData = sampleIdx ? _bank[sampleIdx] : null;
					if( sampleData )
					{
						this.m_data = sampleData.pcm;
						this.m_loopStart = sampleData.repeat_start;
						this.m_loopEnd = sampleData.repeat_length ? (sampleData.repeat_start + sampleData.repeat_length) : 0;
						this.m_finetune = sampleData.finetune;
						this.m_sampleVolume = sampleData.volume;
					}
						
					this.m_period = this.m_basePeriod * this.m_finetune;
				}
			break;
		}
	}	
	
	this.Tick(0);
}

Channel.prototype.Tick = function( _tick, pos, div )
{
	this.m_arpeggio = 0;
	
	switch( this.m_effect )
	{
		case 0:		// arpeggio x y
				switch( _tick % 3 )
				{
					case 1:
							this.m_arpeggio = this.m_basePeriod * this.m_finetune * (Math.pow( c12throot2, this.m_effectX ) - 1);
						break;
						
					case 2:
							this.m_arpeggio = this.m_basePeriod * this.m_finetune * (Math.pow( c12throot2, this.m_effectY ) - 1);
						break;
				}			
			break;
			
		case 1:		// portamento up
				if( _tick )
				{
					this.m_period -= this.m_effectX * 16 + this.m_effectY;
				}
			break;
		case 2:		// portamento down
				if( _tick )
				{
					this.m_period += this.m_effectX * 16 + this.m_effectY;
				}
			break;
		case 3:		// slide to note
				if( this.m_slideToNote != this.m_period )
				{
					var slideToNoteRate = this.m_effectX * 16 + this.m_effectY;
					if( slideToNoteRate )
					{
						this.m_slideToNoteRate = slideToNoteRate;
					}
					else
					{
						slideToNoteRate = this.m_slideToNoteRate;
					}
					
					if( this.m_slideToNote < this.m_period )
					{
						this.m_period -= slideToNoteRate;
						this.m_period = (this.m_period < this.m_slideToNote ? this.m_slideToNote : this.m_period );
					} 
					else if( this.m_slideToNote > this.m_period )
					{
						this.m_period += slideToNoteRate;
						this.m_period = (this.m_period > this.m_slideToNote ? this.m_slideToNote : this.m_period );
					}
				}
			break;
		case 4:		// vibrato: TODO
			break;
		case 5:		// continue slide to note; also, volume slide
				{
					if( this.m_effectX )
					{
						this.m_sampleVolume += (this.m_effectX)/64;
						this.m_sampleVolume = (this.m_sampleVolume>1) ? 1 : this.m_sampleVolume;
					}
					else if( this.m_effectY )
					{
						this.m_sampleVolume -= (this.m_effectY)/64;
						this.m_sampleVolume = (this.m_sampleVolume<0) ? 0 : this.m_sampleVolume;
					}
				
					if( this.m_slideToNote < this.m_period )
					{
						this.m_period -= slideToNoteRate;
						this.m_period = (this.m_period < this.m_slideToNote ? this.m_slideToNote : this.m_period );
					} 
					else if( this.m_slideToNote > this.m_period )
					{
						this.m_period += slideToNoteRate;
						this.m_period = (this.m_period > this.m_slideToNote ? this.m_slideToNote : this.m_period );
					}
				}
			break;
		case 6:		// Continue vibrato (TODO); also, volume slide
				{
					if( this.m_effectX )
					{
						this.m_sampleVolume += (this.m_effectX)/64;
						this.m_sampleVolume = (this.m_sampleVolume>1) ? 1 : this.m_sampleVolume;
					}
					else if( this.m_effectY )
					{
						this.m_sampleVolume -= (this.m_effectY)/64;
						this.m_sampleVolume = (this.m_sampleVolume<0) ? 0 : this.m_sampleVolume;
					}
				}
			break;
		case 7:		// tremolo (TODO)
			break;
		case 8:		// Set panning position (TODO)
			break;
		case 9:		// Set sample offset
				this.m_pos = (this.m_effectX * 4096 + this.m_effectY * 256) * 2;
				this.m_clocks = 0;
				this.m_effect = 0;
				this.m_effectX = 0;
				this.m_effectY = 0;
			break;
		case 0xA:	// Volume slide
				if( _tick )
				{
					if( this.m_effectX )
					{
						this.m_sampleVolume += (this.m_effectX)/64;
						this.m_sampleVolume = (this.m_sampleVolume>1) ? 1 : this.m_sampleVolume;
					}
					else if( this.m_effectY )
					{
						this.m_sampleVolume -= (this.m_effectY)/64;
						this.m_sampleVolume = (this.m_sampleVolume<0) ? 0 : this.m_sampleVolume;
					}
				}
			break;
		case 0xC:	// set volume
				this.m_sampleVolume = (this.m_effectX * 16 + this.m_effectY) / 64;
			break;
		case 0xE:	// extended
				switch( this.m_effectX )
				{
					case 1:	// fineslide up
							if( !_tick )
							{
								this.m_period -= this.m_effectY;
							}
						break;
						
					case 2:	// fineslide down
							if( !_tick )
							{
								this.m_period += this.m_effectY;
							}
						break;
					
					case 9: // retrigger sample
							if( this.m_effectY && !(_tick % this.m_effectY) )
							{
								this.m_pos = 0;
								this.m_clocks = 0;
							}
						break;
						
					case 0xA: // volume up
							if( !_tick )
							{
								this.m_sampleVolume += (this.m_effectY)/64;
								this.m_sampleVolume = (this.m_sampleVolume>1) ? 1 : this.m_sampleVolume;
							}
						break;
						
					case 0xB: // volume down
							if( !_tick )
							{
								this.m_sampleVolume -= (this.m_effectY)/64;
								this.m_sampleVolume = (this.m_sampleVolume>1) ? 1 : this.m_sampleVolume;
							}
						break;
						
					case 0xC: // cut sample
							if( _tick >= this.m_effectY )
							{
								this.m_sampleVolume = 0;
							}
						break;
						
					case 0xD: // delay sample
							if( _tick < this.m_effectY )
							{
								this.m_sampleVolume = 0;
								this.m_pos = 0;
								this.m_clocks = 0;
							}
						break;
				}
			break;
	}
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
	var period = this.m_period + this.m_arpeggio;
	var destPeriod = _destPeriod;
	var loopData = this.m_loopEnd ? data[this.m_loopStart] : 0;
	var volume = this.m_sampleVolume * this.m_channelVolume;

	var csample = data[spos];
	var nsample = ((spos+1)<send) ? data[spos+1] : loopData;
	
	while( dpos < dend )
	{
		
		var left = dend - dpos;
		var runlength = Math.ceil((period - sclocks)/destPeriod);
		runlength = runlength < left ? runlength : left;
		runend = dpos + runlength;

		var prop = (sclocks/period);
		var propinc = (destPeriod/period);
		while( dpos < runend )
		{
			var t = prop; // lerp			
			//var t = prop*prop*prop*(prop*(prop*6 - 15) + 10); // Perlin's smootherstep
			_dest[dpos++] += (t * nsample + (1-t) * csample) * volume;
			prop += propinc;
		}
		
		sclocks += destPeriod * runlength;

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
				send = this.m_loopEnd;
				this.m_repeated = 1;
			}
			csample = nsample;
			nsample = ((spos+1)<send) ? data[spos+1] : loopData;
		}
	}
	this.m_pos = spos;
	this.m_clocks = sclocks;
}

// -- 

TrackerPlaybackCursor.prototype.__init__ = function( _module )
{
	this.m_mod = _module;
	
	this.m_channels = [ ];
	this.m_playing = 1;
	this.m_volume = 1;

	this.m_ticksPerDivision = 6;
	this.m_divisionsPerSecond = 125*4/60;
	this.m_samplesPlayed = 0;
	
	this.m_pos = 0;
	this.m_div = 0;
	this.m_tick = 0;
	this.m_samples = 0;
	
	this.m_fir = [ 0, 0, 0, 0 ];

	var patternIndex = this.m_mod.footer.patterns[0];
	var divisionData = this.m_mod.patternData[patternIndex];
	this.m_sampleLength = ((this.m_mod.GetPlayTime()+0.5) * Mixer.SampleRate);
	
	for( var i = 0; i < _module.channelCount; i++ )
	{
		var channel = new Channel();
		var ddat = divisionData[i];
		channel.Play( ddat, this.m_mod.samples );
		switch( ddat.effect )
		{
			case 0xF:	// set speed
				var z = ddat.X * 16 + ddat.Y;
				if( z<32 )
				{
					this.m_ticksPerDivision = z;
				}
				else
				{
					this.m_divisionsPerSecond = z*4/60;
				}
			break;
		}
		
		this.m_channels.push( channel );
	}
}

// AS interface
// onStart( _mixer )
// onFinish( _mixer )
// GetLength()
// GetPos()
// GetLeft()
// Render( _dest, _start, _len )
// SetVolume( _volume )
TrackerPlaybackCursor.prototype.onStart = function( _mixer )	{ }
TrackerPlaybackCursor.prototype.onFinish = function( _mixer )	{ }
TrackerPlaybackCursor.prototype.GetLength = function()			{ return this.m_sampleLength; }
TrackerPlaybackCursor.prototype.GetPos = function()			{ return this.m_samplesPlayed; }
TrackerPlaybackCursor.prototype.GetLeft = function()			{ return this.m_sampleLength - this.m_samplesPlayed; }
TrackerPlaybackCursor.prototype.SetVolume = function( _volume ){ this.m_volume = _volume; }
TrackerPlaybackCursor.prototype.GetSamplesPerTick = function()
{
	var samplesPerDivision = (Mixer.SampleRate * this.m_ticksPerDivision) / ( 6 * this.m_divisionsPerSecond );
	
	return samplesPerDivision / this.m_ticksPerDivision;
}

TrackerPlaybackCursor.prototype.GetChannels = function()
{
	return this.m_channels;
}

TrackerPlaybackCursor.prototype.Render = function( _dest, _start, _len )
{
	var destPeriod = ClockRate / Mixer.SampleRate;

	var end = _start + _len;
	for( var i = _start; i < end; ++i )
	{
		_dest[i] = 0;
	}

	if( !this.m_playing )
	{
		return;
	}

	this.m_samplesPlayed += _len;

	var pos = this.m_pos;
	var div = this.m_div;
	var tick = this.m_tick;
	var samples = this.m_samples;

	var dpos = _start;
	var dsamplesPerTick = this.GetSamplesPerTick();
	var channels = this.m_channels;
	var channelCount = channels.length;

	var patternIndex = this.m_mod.footer.patterns[pos];
	var divisionData = this.m_mod.patternData[patternIndex];

	while( dpos < end )
	{
		var samplesleft = Math.floor(dsamplesPerTick - samples);
		var runlength = end-dpos;
		runlength = (samplesleft < runlength) ? samplesleft : runlength;

		for( var channel = 0; channel < channelCount; channel++ )
		{
			channels[channel].Mix( _dest, dpos, runlength, destPeriod );
		}

		dpos += runlength;
		samples += runlength;
		
		if( runlength >= samplesleft )
		{
			++tick;
			samples -= dsamplesPerTick;
			for( var i = 0; i < channelCount; i++ )
			{
				channels[i].Tick(tick);
			}
			
			if( tick >= this.m_ticksPerDivision )
			{
				tick = 0;
				var nextdiv = div + channelCount;
				
				for( var i = 0; i < channelCount; i++ )
				{
					var ddat = divisionData[div+i];
					switch( ddat.effect )
					{
						case 0xB:	// jump to order
								pos = ddat.X * 16 + ddat.Y - 1;
								nextdiv = 64*4; // force division data reload
							break;
							
						case 0xD:	// pattern break
								pos++;
								nextdiv = ddat.X * 10 + ddat.Y;
							break;
					}
				}
				
				div = nextdiv;
				
				if( div >= 64*4 )
				{
					++pos;
					div = 0;
					patternIndex = this.m_mod.footer.patterns[pos];
					if( pos >= this.m_mod.footer.songPositions )
					{
						this.m_pos = 0;
						this.m_div = 0;
						this.m_tick = 0;
						this.m_samples = 0;
						this.m_playing = 0;
						return;
					}
					divisionData = this.m_mod.patternData[patternIndex];
				}
				
				for( var i = 0; i < channelCount; i++ )
				{
					var ddat = divisionData[div+i];
					channels[i].Play( ddat, this.m_mod.samples );
					switch( ddat.effect )
					{
						case 0xF:	// set speed
								var z = ddat.X * 16 + ddat.Y;
								if( z<=32 )
								{
									this.m_ticksPerDivision = z;
								}
								else
								{
									this.m_divisionsPerSecond = z*4/60;
								}
								dsamplesPerTick = this.GetSamplesPerTick();
							break;
					}
				}
			}
		}
	}

	this.m_pos = pos;
	this.m_div = div;
	this.m_tick = tick;
	this.m_samples = samples;
	
	for( var i = _start; i < end; ++i )
	{
		_dest[i] *= this.m_volume;
	}
	
	/*
	var fir = this.m_fir;
	for( var i = _start; i < end; ++i )
	{
		var level = _dest[i];
		var sample = 
			level * 0.125 + 
			fir[0] * 0.2 + 
			fir[1] * 0.35 + 
			fir[2] * 0.2 + 
			fir[3] * 0.125;
		fir[3] = fir[2];
		fir[2] = fir[1];
		fir[1] = fir[0];
		fir[0] = level;
		_dest[i] = sample * this.m_volume;
	}
	*/
}

})();
// -----------------------------------------------------------------------------------------------

TrackerModule.prototype.Play = function()
{
	var handle = new TrackerPlaybackCursor(this);
	Mixer.Queue_Audio( handle );
	return handle;
}

// -----------------------------------------------------------------------------------------------
})();
// -----------------------------------------------------------------------------------------------