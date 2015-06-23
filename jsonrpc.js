var net = require('net'),
	fs = require('fs'),
	util = require('util'),
	EventEmitter = require("events").EventEmitter;

var oldUMask = process.umask(0000);

function UnixJSONRPC(path) {
	if (fs.existsSync(path)) {
		fs.unlinkSync(path);
	}

	var self = this;

	var server = this.server = net.createServer(function(socket) {
		console.log("[Server] Client connected");

		var buffer = '';

		socket.respond = function(data) {
			this.write(JSON.stringify(data) + "\n");
		};

		socket.on('data', function(data) {
			buffer += data.toString('utf8');

			var index = -1;

			do {
				index = buffer.indexOf("\n");

				if (index !== -1) {
					var str = buffer.substring(0, index);

					self.handleData(socket, JSON.parse(str));

					buffer = buffer.substring(index + 1);
				}
			} while (index !== -1);
		});

		socket.on('end', function() {
		});
	});

	server.listen(path, function() {
		process.umask(oldUMask);
		console.log('Listening.');
	});

	EventEmitter(this);
}

util.inherits(UnixJSONRPC, EventEmitter);

UnixJSONRPC.prototype.handleData = function(socket, obj) {
	this.emit(obj.method, obj.parameters, UnixJSONRPC.prototype.write.bind(this, socket));
};

UnixJSONRPC.prototype.write = function(socket, obj) {
	socket.write(JSON.stringify(obj) + "\n");
};

module.exports = UnixJSONRPC;