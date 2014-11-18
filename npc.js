#!/usr/bin/env node
var http = require('http');
var os = require('os');
var fs = require('fs');
var spawn = require('child_process').spawn;
var args = process.argv.slice(2);
var cmd = args[0];
var env = process.env;
var port = env.PORT || 15577;
var ttl = env.TTL || '1d';
var log = console.log;
var peers = {};
var cache = {};
var self;
var ipStart;
var ipEnd = 0;
var npm;

getIp();
setInterval(getIp, 99);

if (cmd == 'serve') {
  serve();
  //setInterval(discover, 9);
}
else {
  ttl = +(ttl.replace(/(\d+)(\w+)/, function (m, d, w) {
    return d * (({m: 60, h: 3600, d: 86400, w: 406800})[w] || 1);
  }));
  http.get(u(self, 'p')).on('error', function () {
    run('nohup', [__filename, 'serve']);
  });
  if (/^i(|nstall)$/.test(cmd)) {
    findPeers();
  }
  else {
    npm = run('npm', args);
    npm.stdout.pipe(process.stdout);
    npm.on('close', process.exit);
  }
}

function findPeers() {
  var list = [];
  var map = {};
  args.forEach(function (arg) {
    if (arg[0] != '-') {
      list.push(arg);
      map[arg] = 0;
    }
  });
  var wait = 256;
  function tryPeer(peer) {
    http.get(u(peer, 't/' + list.join('/')), function (res) {
      var data = ''
      res.on('data', function (chunk) {
        data += chunk;
      });
      res.on('end', function () {
        log(data);
      });
      if (!--wait) done();
    }).on('error', function () {
      if (!--wait) done();
    });
  }
  for (var i = 0; i < 256; i++) {
    tryPeer(ipStart + i);
  }
  function done() {
    log('done');
  }
}

function serve() {
  var list, peer;
  run('npm', ['config', 'get', 'cache'], function (dir) {
    npm = dir.replace(/\s+$/, '');
    loadCache();
  });
  http.createServer(function (req, res) {
    var url = req.url;
    var html = '';
    var remote = req.connection.remoteAddress;
    if (remote) {
      peers[remote] = Date.now() / 1e3;
    }
    if (url == '/') {
      end(res, cache);
    }
    else if (url == '/p') {
      list = [];
      for (peer in peers) {
        list.push(peer);
      }
      end(res, list);
    }
    else if (url.substr(0, 3) == '/t/') {
      var now = Date.now() / 1e3;
      var map = {};
      list = url.substr(3).split('/');
      var ttl = +list.shift();
      var wait = list.length;
      list.forEach(function (name) {
        var item = cache[name];
        log(name, item);
        if (item && (item.t > now - ttl)) {
          map[name] = item;
        }
      });
      end(res, map);
    }
    else if (url.substr(0, 3) == '/z/') {
      var path = npm + url.substr(2) + '/package.tgz';
      fs.readFile(path, function (e, data) {
        res.end(data, 'binary');
        log(e, data);
      });
    }
    else {
      end(res, {});
    }
  }).listen(port);
}

function end(res, object) {
  res.end(JSON.stringify(object));
}

function discover() {
  ipEnd = (ipEnd + 1) % 256;
  var peer = ipStart + ipEnd;
  if (peer != self) {
    http.get(u(peer, 'ok'), function () {
      log('Found: ' + u(self, ''));
      peers[peer] = true;
    })
    .on('error', function () {
      delete peers[peer];
    });
  }
}

function loadCache() {
  fs.readdir(npm, function (e, dirs) {
    if (!e) {
      dirs.forEach(loadPackage);
    }
  });
}

function loadPackage(name) {
  var dir = npm + '/' + name;
  fs.readdir(dir, function (e, keys) {
    if (!e) {
      var max = 0;
      var version;
      keys.forEach(function (key) {
        var n = 0;
        key.replace(/\d+/g, function (d) {
          n = n * 1e3 + +d;
        });
        if (n > max) {
          max = n;
          version = key;
        }
      });
      if (version) {
        fs.stat(dir + '/' + version + '/package.tgz', function (err, stat) {
          if (!err) {
            cache[name] = {v: version, t: stat.mtime.getTime() / 1e3};
          }
        });
      }
    }
  });
}

function a(host, path, text) {
  return '<a href="' + u(host, path) + '">' + text + '</a>';
}

function u(host, path) {
  return 'http://' + host + ':' + port + '/' + path;
}

function gotIp(ip) {
  if (ip != self) {
    self = ip;
    ipStart = ip.replace(/\.\d+$/, '.');
  }
}

function getIp() {
  var interfaces = os.networkInterfaces();
  for (var key in interfaces) {
    var list = interfaces[key];
    for (var i = 0; i < list.length; i++) {
      var interface = list[i];
      if ((interface.family == 'IPv4') && !interface.internal) {
        gotIp(interface.address);
      }
    }
  }
}

function run(cmd, args, fn) {
  var data = '';
  var child = spawn(cmd, args, {env: env});
  child.stdout.on('data', function (chunk) {
    data += chunk;
  });
  child.on('close', function () {
    if (fn) {
      fn(data);
      fn = 0;
    }
  });
  return child;
}
