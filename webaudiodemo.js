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
		"  G   A   B             ",
	];

	var middle = 
	[
		"G-----A-----B-----B-----",
		"B A G B A G B A G B A G ",
	];
		
	Synthesizer.SetBaseDuration( 1/2 );
	Synthesizer.SetTrackInstrument( 0, Synthesizer.Instruments.Glock );
	Synthesizer.SetTrackVolume( 0, 1.0 );
	Synthesizer.SetTrackInstrument( 1, Synthesizer.Instruments.Glock );
	Synthesizer.SetTrackVolume( 1, 1.0 );
	
	Mixer.SetVolume( 0.5 );
	
	var afidintro = 
	[
		"A'",
		"E ",
		
		"C ",
		"A.",
	];
	
	var afid =
	[//  |       |       |       |       |
		"A'--A'A'B'--    C'B'C'D'C'--B'A'",
		"E --E C E --E --E E E F E --E C ",
		"C --A A G.--B --  B   A A --G.A ",
		"A.--C.A.E.--G.--  G.  D.E.--E.F.",
	];
	
	Synthesizer.QueueTracks( afidintro, afid, afid );
}