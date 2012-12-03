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
	
	Synthesizer.SetTrackInstrument( 0, Synthesizer.Instruments.Glock );
	Synthesizer.SetTrackVolume( 0, 1.0 );
	Synthesizer.SetTrackInstrument( 1, Synthesizer.Instruments.Glock );
	Synthesizer.SetTrackVolume( 1, 0.4 );
	
	Synthesizer.SetMasterVolume( 0.5 );
	
	Synthesizer.QueueTracks( refrain, middle );
}