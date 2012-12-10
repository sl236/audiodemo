var boot = null;
(function(){
// -----------------

function gotModule( data )
{
	var mod = new TrackerModule(data);
	/*
	console.log(mod.title + ': ' + mod.footer.magic);
	for( var i = 1; i < mod.samples.length; i++ )
	{
		console.log( i + ': ' + mod.samples[i].title + ' / ' + mod.samples[i].len );
	}
	*/
	mod.Play();
}

function readText( _file, _cb )
{
        $.ajax({
            url: _file,
            dataType: 'text',
            success: _cb,
            error: (function(_f)
                    { 
                        return function(_xhr, _status, _thrown ) 
                        { 
                            console.Log("Failed to read '" + _f + "': " + _status.toString() + "; " + _thrown.toString());
                        }
                    }
                )(_file)
        });
}

boot = function()
{
	if( !Mixer.Init() )
	{
		console.log( "Audio init failed!" );
		return;
	}

	readText('elysium.mod.b64', gotModule);
}
// -------------------
})();