function boot()
{
	if( !Mixer.Init() )
	{
		console.log( "Audio init failed!" );
		return;
	}

	// ----	
	var scale = [ "D.d.E.F.f.G.g.A.a.B.C c D d E F f G g A a B C'c'D'd'E'F'f'G'g'A'a'B'" ];
		
	var refrain = 
	[
		"G---A---B---B---A---G---",
		"                        "
	];

	var middle = 
	[
		"G---A---B---B---A---G---",
		"D B.E c f E D B.E c f E "
	];
	
	var playNote = Synthesizer.TriggerNote;	
	Synthesizer.TriggerNote = function(track, note)
	{
		playNote( track, note );
		if( track == 0 ) // major chords on track 0
		{
			note.id += 4;
			playNote( track, note );
			note.id += 3;
			playNote( track, note );
		}
	}
	
	Synthesizer.SetADSR( 0,  0.3, 0.2, 0.6, 0.3 );
	Synthesizer.SetADSR( 1,  0.1, 0.05, 0.4, 0.5 );	
	Synthesizer.QueueTracks( refrain, refrain, middle, middle );
}