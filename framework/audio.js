var Mixer = 
{
	Init: function()													{},
	Queue_Audio: function( handle )										{},

	SampleRate: 0,
	Channels: 1,
	BufferLength: 1024
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
	var pos = 0;
	while( pos < len )
	{
		if( pending.length && (pending[0].GetStart() <= (pos + currentMixSample) ) )
		{
			do
			{
				var obj = pending.shift();
				obj.onStart();
				active.push( obj );
			} while( pending.length && (pending[0].GetStart() <= (pos + currentMixSample) ) );

			active.sort( function(a,b) { return a.GetLeft() - b.GetLeft(); } );
		}

		var runlength = (len-pos);
		var lenToPending = pending.length ? (pending[0].m_start - (pos+currentMixSample)) : runlength;
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

			while( active.length && (active[0].GetLeft() <= 0) )
			{
				active.shift().onFinish();
			}
		}

		pos = runend;
	}

	currentMixSample += len;
}

// ----
AS_PCM.prototype.__init__ = function( data, delay )
{
	this.m_data = data;
	this.m_start = delay + currentMixSample;
	this.m_pos = 0;
	this.m_left = data.length;
}

AS_PCM.prototype.onStart = function()
{
	this.m_pos = (this.m_pos + currentMixSample) - this.m_start;
	this.m_left -= this.m_pos;
}

AS_PCM.prototype.GetStart = function()
{
	return this.m_start;
}

AS_PCM.prototype.GetLength = function()
{
	return this.m_data.length;
}

AS_PCM.prototype.GetLeft = function()
{
	return this.m_left;
}

AS_PCM.prototype.Sample = function()
{
	--this.m_left;
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
	this.m_left = duration;
}

AS_SineWave.prototype.onStart = AS_PCM.prototype.onStart;
AS_SineWave.prototype.GetStart = AS_PCM.prototype.GetStart;
AS_SineWave.prototype.GetLeft = AS_PCM.prototype.GetLeft;
AS_SineWave.prototype.onFinish = AS_PCM.prototype.onFinish;

AS_SineWave.prototype.GetLength = function()
{
	return this.m_length;
}

AS_SineWave.prototype.Sample = function()
{
	--this.m_left;
	var p = this.m_pos++;
	return Math.sin( p * this.m_factor );
}

// ----
Filter_ADSR.prototype.__init__ = function( handle, Alen, Dlen, Svol, Rlen )
{
	this.m_src = handle;
	this.m_Alen = Alen;
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
Filter_ADSR.prototype.GetLength = function() { return this.m_src.GetLength(); };
Filter_ADSR.prototype.onFinish = function() { this.m_src.onFinish(); };

Filter_ADSR.prototype.Sample = function()
{
	var sample = this.m_src.Sample();
	var pos = 1 - (this.m_src.GetLeft() / this.m_src.GetLength());
	if( pos <= this.m_Aend )
	{
		sample *= (pos / this.m_Alen);
	}
    else if( pos <= this.m_Dend )
	{
		sample *= 1 - (((pos - this.m_Alen) / this.m_Dlen) * (1-this.m_Svol));
	} 
	else if( pos <= this.m_Send )
	{
		sample *= this.m_Svol;
	}
	else
	{
		sample *= (pos - this.m_Send) / this.m_Rlen;
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
		Mixer.SampleRate = 22050;
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