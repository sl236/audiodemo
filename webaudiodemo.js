function boot()
{
	if( !Mixer.Init() )
	{
		console.log( "Audio init failed!" );
		return;
	}

	var noteLength = Math.floor(Mixer.SampleRate / 4);
	var notes =
	{
		'A': { frq: 220, len: noteLength },
		'B': { frq: 247, len: noteLength },
		'C': { frq: 262, len: noteLength },
		'D': { frq: 294, len: noteLength },
		'E': { frq: 330, len: noteLength },
		'F': { frq: 349, len: noteLength },
		'G': { frq: 392, len: noteLength },
	};
	notes[' '] = { };

	var tracks = 
	[
		'AABBCCDDEEFFGGAA',
	];

	var pos = 0;	
	for( var j = 0; j < tracks[0].length; j++ )
	{
		var step = 0;
		for( var i = 0; i < tracks.length; i++ )
		{
			var note = notes[tracks[i].charAt(j)];
			if( note )
			{
				if( note.frq )
				{
					Mixer.Queue_Audio( new Filter_ADSR( new AS_SineWave( note.frq, note.len, pos ), 0.1, 0.1, 0.7, 0.1 ) );
				}
				step = (step<note.len) ? note.len : step;
			}
		}
		pos += step;
	}
}