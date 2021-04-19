module.exports = new (function DummyLtd(){
	
	const Path                  = require('path');
	const FileSystem            = require('fs');
	const DS                    = Path.sep;
	const DIR_ROOT              = __dirname+DS;
	const Http 					= require('http');
	const PORT_FOR_MOBILE		= 8008;
	const PORT_FOR_UX 			= 8009;
	
	var __httpserver			= null;
	var __dummyserver			= null;
	var __manifest 				= {};
	var __ux 					= '';
	
	function __construct(){
		
		__loadUx(() => {
			__loadManifest(() => {
				// http server
				__createServer(PORT_FOR_MOBILE, function(req, res){
					req.on('data', function(chunk) {
						body += chunk;
					});
					req.on('end', function(){
						try{
							body = JSON.parse(body);
						} catch(e){
							console.error("Invalid incoming json syntax", e);
							body = {};
						}
						__request(req.url, body, res);
					});
				}, (server) => {
					__httpserver = server;
					__createServer(PORT_FOR_UX, function(req, res){
						if(req.method.toLowerCase()=='get'){
							res.writeHead(200);
							res.end(__ux);						
						} else {
							// extract paramater json
							let body = '';
							req.on('data', function(chunk) {
								body += chunk;
							});
							req.on('end', function(){
								if(body!=''){
									let params = {};
									body.split("\n").forEach(function(v){
										let pos = v.indexOf('=');
										if(pos>=0){
											let name = v.substring(0, pos).replace(/^[\r\n\t\s]+/, '').replace(/[\r\n\t\s]+$/, '');
											let value = v.substring(pos+1, v.length).replace(/^[\r\n\t\s]+/, '').replace(/[\r\n\t\s]+$/, '');
											params[name] = value;
										}
									});
									try{
										params.json = JSON.parse(params.json);
									} catch(e){
										console.error("Incoming wrong syntax json", e);
										params.json = {};
									}
									__request(params.url, params.json, res);
								} else {
									__request(params.url, {}, res);
								}
							});
						}
					}, (server) => {
						console.clear();
						console.log('************************************************');
						console.log('*     ___//                                    *');
						console.log('*    / .__.\\         Dummy is ready !          *');
						console.log('*    \\  \\/ /                                   *');
						console.log('*  __/     \\   use 127.0.0.1:'+PORT_FOR_MOBILE+' for mobiles  *'); 
						console.log('*  \\-       )  use 127.0.0.1:'+PORT_FOR_UX+' for web ux   *');
						console.log('*   \\_______/		                       *');
						console.log('*     |  |                                     *');
						console.log('******"**"**************************************');
					});
				});
			});
		});
	}
	
	function __request(url, body, res){
		
		console.log('Entering request', { url: url, body: body });
		
		try{
			
			// Resolve uri routing
			var result = {"code": 404, "error": "not found"};
			__crawl(
				__manifest,
				(router, index, ack) => {
					// Matching route, extract params
					let regex 		= new RegExp(router.route);
					let matches 	= regex.exec(url);
					let segments 	= [];
					let buffer 		= null;
					// Route is not matching
					if(matches==null){ ack(); return false;	}
					
					// Extract url parameters
					let params = [];
					let l = matches.length;
					let i = 0;
					
					for(i=1; i<l; i++){ params[(i-1)] = matches[i]; }
					
					// Check conditions
					let cond_ok = true;
					if(typeof router.conditions!='undefined'){
						let key = null;
						let index = null;
						for(key in router.conditions){
							if(key.charAt(0)=='$'){
								// Condition url parameter
								index = parseInt(key.substring(1, key.length));
								regex = new RegExp(router.conditions[key]);
								if(!regex.test(params[index-1])){
									cond_ok = false;
									break;
								}
							} else {
								// Condition data parameter
								segments = key.split('.');
								buffer = Object.assign({}, body);
								l = segments.length;
								for(i=0; i<l; i++){
									if(typeof buffer[segments[i]]!='undefined'){
										buffer = buffer[segments[i]]
									} else {
										buffer = null;
										i = l;	
									}
								}
								if(buffer==null){ ack(); return false;	} // missing parameter
								regex = new RegExp(router.conditions[key]);
								if(!regex.test(buffer)){ ack(); return false; } // mismatching parameter
							}
						}
					}
					
					// Condition not match
					if(!cond_ok){
						ack();
						return false;
					}
					
					// Return matching content
					console.log('Return', { code: router.response.code, body: router.response.body });
					res.writeHead(router.response.code);
					res.end(JSON.stringify(router.response.body));
					return false;
					
				},
				() => {
					
					console.log('Return', { code: 404, body: {"error": "not found"} });
					res.writeHead(404);
					res.end(JSON.stringify({"error": "not found"}));
					
				}
			);
		} catch(e){
			console.error(e);
			res.writeHead(503);
			res.end(JSON.stringify({"error": e}));
		}		
		
	}
	
	function __crawl(list, onItem, onComplete, index){
		index = typeof index == 'undefined' ? 0: Math.max(0, index);
		if(index>=list.length){ onComplete(); return false }
		onItem(list[index], index, function(){
			process.nextTick(() => {
				__crawl(list, onItem, onComplete, index+1);
			});
		});
	}
	
	function __loadUx(callback){
		let path = DIR_ROOT + 'ux.htm';
		FileSystem.lstat(path, (err, lstat) => {
			if(err){
				console.error('File "ux.htm" not found');
			} else {
				FileSystem.readFile(path, (err, data) => {
					console.log('ux loaded');
					__ux = data.toString('utf8');
					callback();
				});
			}
		});		
	}
	
	function __loadManifest(callback){
		let path = DIR_ROOT + 'manifest.json';
		FileSystem.lstat(path, (err, lstat) => {
			if(err){
				console.error('File "manifest.json" not found');
			} else {
				FileSystem.readFile(path, (err, data) => {
					data = data.toString('utf8');
					try{
						let buffer = JSON.parse(data);
						console.log('manifest loaded');
						__manifest = buffer;
						callback();
					} catch(e){
						console.error('File "manifest.json" invalid json syntax: '+e);
					}
				});
			}
		});
		// Watch update
		FileSystem.watch(path, (eventType, filename) => {
			if(eventType=='change'){
				// update manifest
				FileSystem.readFile(path, (err, data) => {
					data = data.toString('utf8');
					try{
						let buffer = JSON.parse(data);
						console.log('manifest reloaded');
						__manifest = buffer;
					} catch(e){}
				});
			}
		});
	}
	
	function __createServer(port, onSocket, callback){
		let portInUse = false;
		let server 	= Http.createServer(onSocket);
		server.on('error'   , function(err){ 
			if(err.code=='EADDRINUSE'){ 
				console.error('Port '+port+' in use');
				portInUse = true; 
			} else {
				console.error('Server error', err);
			}
			server.close(); 
		});
		server.on('timeout' , function(){ server.close(); });
		server.on('close'   , function(){ 
			// restart
			if(!portInUse){
				process.nextTick(() => {
					console.error('Server try to restart');
					__createServer();
				});
			}
		});
		server.listen(port, function(){
			console.error('Server is now listening port '+port);
			callback(server);
			callback = function(){};
		});		
	}
	
	__construct();
	
})();