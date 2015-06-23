# PowerDNS-GeoDNS

An experimental GeoDNS implementation in node for PowerDNS, using the Remote backend and a unix socket.

# Usage
Requirements:

* PowerDNS 3.2 or newer with the Remote and MySQL backends
* node.js (Possibly 0.10, but I use 0.12)
* A system which supports Unix sockets
* A Maxmind GeoIP City Database (free or paid, The easiest place to put this is in ./geoip, as the default points to geoip/GeoIP2-City.mmdb)

Installation:

1. Install PowerDNS, MySQL, and the required backends
2. Install node and get a copy of this program, using npm install to install the dependencies (git clone works well for this)
3. Start the process, optionally using Supervisor.
4. Restart PowerDNS and run a dig command targeting your server to see if it works.
5. Create a record in SQL, see the section below for record formats.

# Records
This uses Knexjs to query your MySQL database for records. Right now, the records are pretty strict and can easily be messed up, this'll be changed in the future.

Create a record with type "DYNA" and the standard settings for an A record, but the contents should be "map: map name", where map name is the record we'll add next.

Add a record with type "MAP", the name being the same as the dyna record's content, and the contents your ip addresses, each separated by a comma (no spaces).

Structure (It only requires domain_id, name, type, content, and ttl):

	(`id`, `domain_id`, `name`, `type`, `content`, `ttl`, `prio`, `change_date`, `disabled`, `ordername`, `auth`)

Example DYNA:

	(NULL, 1, 'geo.example.com', 'DYNA', 'map: geo', 86400, 0, 0, 0, NULL, 1);

Example MAP:

	(NULL, 1, 'geo', 'MAP', '8.8.8.8,4.4.2.2,8.8.4.4', 0, 0, 0, 0, NULL, 1);


# Supervisor
It's best to keep the process running using Supervisord. An example config is as follows.

	[program:geodns]
	autostart=true
	autorestart=true
	process_name=%(program_name)s
	user=pdns
	command=node server.js
	directory=/usr/local/geodns
	stderr_logfile = /var/log/supervisord/geodns-stderr.log
	stdout_logfile = /var/log/supervisord/geodns-stdout.log
	
# Issues
I'm not sure how easy this will be to understand, and it's quite finicky about the setup as are most dns related things. I can't exactly help you 