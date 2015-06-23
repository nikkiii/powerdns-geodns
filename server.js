var JsonRPC = require('./jsonrpc'),
	async = require('async'),
	fs = require('fs'),
	path = require('path'),
    mmdbreader = require('maxmind-db-reader'),
    geolib = require('geolib'),
	ip = require('ip'),
	mkdirp = require('mkdirp');

var opt = require('optimist')
	.boolean('help')
	.usage('Usage: $0')
	.options('maxminddb', {
		alias : 'd',
		describe : 'MaxMind Database Path',
		default : 'geoip/GeoIP2-City.mmdb'
	})
	.options('pdnscfg', {
		alias : 'c',
		describe : 'PowerDNS Config (File which contains mysql settings)',
		default : '/etc/powerdns/pdns.d/pdns.local.gmysql.conf'
	})
	.options('socket', {
		alias : 's',
		describe : 'Unix Socket Path (The parent directory will be created for you)',
		default : '/var/run/geodns/geodns.sock'
	});

var argv = opt.argv;

if (argv.help) {
	opt.showHelp();
	return;
}

var geoip = mmdbreader.openSync(argv.maxminddb),
	geoipCache = {};

var cfg = loadPdnsConfig(argv.pdnscfg);

var knex = require('knex')({
	client: 'mysql',
	connection: {
		host     : cfg['gmysql-host'],
		user     : cfg['gmysql-user'],
		password : cfg['gmysql-password'],
		database : cfg['gmysql-dbname']
	}
});

mkdirp.sync(path.dirname(argv.socket), {
	mode : 0777
});

var server = new JsonRPC(argv.socket);

server.on('initialize', function(data, respond) {
	respond({ result : true });
});

server.on('lookup', function (data, respond) {
    if (data.qtype == 'ANY' || data.qtype == 'A') {
		var dyna = false;
		knex('records').where({
			name: data.qname,
			type: 'DYNA'
		}).first('name', 'content', 'domain_id', 'ttl')
			.then(function(row) {
				if (!row) {
					respond({"result":false});
					return false;
				}
				dyna = row;
				return knex('records').where({
					name: row.content.substring(5),
					type: 'MAP',
					domain_id: row.domain_id
				}).first('content');
			})
			.then(function(record) {
				if (!record) {
					respond({"result":false});
					return false;
				}
				var addr = data['real-remote'];

				addr = addr.substring(0, addr.indexOf('/'));

				var servers = record.content.split(",");

				geoip.getGeoData(addr, function(err, geodata) {
					if (err || !geodata || !('location' in geodata)) {
						respond({
							"result": [{
								"qtype": "A",
								"qname": record.content,
								"content": servers[0],
								"ttl": 60
							}]
						});
						return;
					}

					var user = geodata.location;

					async.sortBy(servers, function(server, callback) {
						if (server in geoipCache) {
							callback(null, geolib.getDistance(user, geoipCache[server]));
							return;
						}
						geoip.getGeoData(server, function(err, geodata) {
							geoipCache[server] = geodata.location;
							callback(null, geolib.getDistance(user, geodata.location));
						});
					}, function(err, results) {
						var closest = results[0];

						// TODO scopeMask to allow more accurate responses and caching
						respond({
							"result": [{
								"qtype": "A",
								"qname": dyna.name,
								"content": closest,
								"ttl": dyna.ttl,
								"scopeMask": 24
							}]
						});
					});
				});
			});
    } else {
        respond({"result":false});
    }
});

function loadPdnsConfig(file) {
	var file = fs.readFileSync(file),
		cfg = {};

	var re = /(.*?)\+?=(.*)/g;

	while (match = re.exec(file)) {
		cfg[match[1]] = match[2];
	}

	return cfg;
}