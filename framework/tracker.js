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
	result.finetune = data[pos];
	pos += 1;
	result.volume = data[pos];
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
		this.patternData[i] = data.subarray( pos, pos+1024 );
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
			pcm[j] = (s>127) ? (s-256) : s;
		}
		this.samples[i].pcm = pcm;
		pos += len;
	}
}


// -----------------------------------------------------------------------------------------------
})();
// -----------------------------------------------------------------------------------------------