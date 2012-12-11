js.audiodemo
============

Javascript audio mixer and modplayer.  
Works both in Firefox and Chrome.

***

Samples
=======

Play [klisje.mod](http://www.toothycat.net/~sham/dev/webaudiodemo/?klisje.mod.b64)  
Play [elysium.mod](http://www.toothycat.net/~sham/dev/webaudiodemo/?elysium.mod.b64)

***

Documentation
=============

## audio.js
### mixer, one-shot SFX, simple synthesizer

Configuring the mixer:
```javascript
Mixer.Channels = 1; // default is 1. Stereo not yet supported, but will be in the future.
Mixer.BufferLength = 4096; // in samples; must be a power of 2; default is 4096. A shorter buffer length means less latency but the audio will be choppy if the buffer is too small.
// the above values cannot be changed after Mixer.Init() is called.

if( !Mixer.Init() ) // call this once before interacting with audio in any other way.
{
    // audio initialisation failed. Functions will silently do nothing. You might want to let the user know.
}

// Mixer.SampleRate now holds a valid value
Mixer.SetVolume( 0.5 ); // 0.0 .. 1.0; default is 1.0
```

Playing one-shot fire-and-forget sound effects:  

```javascript
// given a var pcm which is a Float32Array of PCM samples 
// representing audio sampled at Mixer.SampleRate
Mixer.Queue_Audio( new AS_PCM( pcm ) ); // plays the sound immediately

Mixer.Queue_Audio( new AS_PCM( pcm ), 20*Mixer.SampleRate ); // plays the sound after a delay of 20 seconds

var control = new AS_PCM( pcm );
Mixer.Queue_Audio( control );
control.SetVolume( 0.2 ); // allows you to control parameters of this sound effect instance before/after queuing

Mixer.Queue_Audio( new AS_SineWave( 1024, 2*Mixer.SampleRate ) ); // plays a 1024Hz sine wave lasting 2 seconds

// given a, d, r which are proportions of the length of the audio being filtered
// representing attack, decay, release times, 
// and an s which is the desired sustain volume:
Mixer.Queue_Audio( new Filter_ADSR( new AS_SineWave( 1024, 2*Mixer.SampleRate ), a, d, s, r ) );

// forming audio graphs
var mix = new Filter_Mix(); 
mix.Queue_Audio( new AS_PCM( something ) );
mix.Queue_Audio( new AS_PCM( somethingelse ) );
mix.SetVolume( 0.2 );
Mixer.Queue_Audio( new Filter_ADSR( mix, a, d, s, r ) );
// mix will be released when all its children have finished playing

```

Any mixer, filter or audio source can also be forced to render into a buffer you supply:
```javascript
var mix = new Filter_Mix(); 
mix.Queue_Audio( new AS_PCM( something ) );
mix.Queue_Audio( new AS_PCM( somethingelse ) );
mix.SetVolume( 0.2 );

var pcm = new Float32Array( mix.GetLength() );
mix.Render( pcm, 0, mix.GetLength() ); 
// note mix is now useless and may be discarded
// you could, for instance, mix a whole lot of sine waves and ADSR-filter 
// to simulate harmonics of an instrument
```


Using the simple synthesizer:

```javascript
 var tune = [
    "G---A---B---B---A---G---",
    "D B.E c f E D B.E c f E "
 ];
 
 // each string in the array is a track; all tracks are played simultaneously.
 // each track is a sequence of pairs of characters. 
 
 // The first is a note, lower case to make it sharp; or a dash, to continue
 // the previous note; or any other character for silence.
 // The second is a digit representing the octave; C4 is middle C. 
 // As a shorthand, . is 3, - and space are 4, and ' is 5. 
 
 Synthesizer.SetBaseDuration( 1/2 ); // one note plays for this long. 
 // Set this to the shortest length required, then use -- to create longer notes. 
 Synthesizer.SetTrackInstrument( 0, Synthesizer.Instruments.Glock ); // some toy instruments are provided
 Synthesizer.SetTrackVolume( 0, 1.0 );
 Synthesizer.SetTrackInstrument( 1, Synthesizer.Instruments.Sine );
 Synthesizer.SetTrackVolume( 1, 0.4 );
 Synthesizer.QueueTracks( tune, tune, tune ); // now SUFFER!
 
```

Using the mod tracker:

```javascript
 // obtaining base64 encoded .mod file is left as an exercise
 // must actually be a mod - formats other than the protracker family are not supported
 var mod = new TrackerModule( base64_encoded_mod );
 // mod.GetChannelCount() will give you the channel count
 // mod.GetPlayTime() gives song duration in seconds
 // mod.GetTitle() gives title
 var samples = mod.GetSamples(); // gives an array of samples
 // now samples[i].title is also there if your visualisation wants that
 
 var handle = mod.Play(); // handle can be used for remote control while the mod is playing
 handle.SetVolume( 0.8 ); // 0.0 - 1.0; default 1.0
 // handle.Pause() toggles paused/playing; handle.IsPaused() to check
 
 var channels = handle.GetChannels(); // returns the channel array
 // this has some interesting values that visualisation code might use:
 // channels[i].GetCurrentPitch()
 // channels[i].GetCurrentVolume() 
 // channels[i].GetCurrentSampleIndex() 
 // channels[i].GetPos() / channels[i].GetLength()
```
