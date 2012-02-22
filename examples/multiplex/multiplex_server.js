var events = require('events');
var stream = require('stream');


exports.MultiplexServer = MultiplexServer = function(service) {
    var that = this;
    this.registered_channels = {};
    this.service = service;
    this.service.on('connection', function(conn) {
        var channels = {};

        conn.on('data', function(message) {
            var t = message.split(',', 3);
            var type = t[0], topic = t[1],  payload = t[2];
            if (!(topic in that.registered_channels)) {
                return;
            }
            switch(type) {
            case 'sub':
                var sub = channels[topic] = new Channel(conn, topic,
                                                                  channels);
                that.registered_channels[topic].emit('connection', sub)
                break;
            case 'uns':
                if (topic in channels) {
                    delete channels[topic];
                    channels[topic].emit('close');
                }
                break;
            case 'msg':
                if (topic in channels) {
                    channels[topic].emit('data', payload);
                }
                break;
            }
        });
        conn.on('close', function() {
            for (topic in channels) {
                channels[topic].emit('close');
            }
            channels = {};
        });
    });
};

MultiplexServer.prototype.registerChannel = function(name) {
    return this.registered_channels[escape(name)] = new events.EventEmitter();
};


var Channel = function(conn, topic, channels) {
    this.conn = conn;
    this.topic = topic;
    this.channels = channels;
    stream.Stream.call(this);
};
Channel.prototype = new stream.Stream();

Channel.prototype.write = function(data) {
    this.conn.write('msg,' + this.topic + ',' + data);
};
Channel.prototype.end = function(data) {
    var that = this;
    if (data) this.write(data);
    if (this.topic in this.channels) {
        this.conn.write('uns,' + this.topic);
        delete this.channels[this.topic];
        process.nextTick(function(){that.emit('close');});
    }
};
Channel.prototype.destroy = Channel.prototype.destroySoon =
    function() {
        this.removeAllListeners();
        this.end();
    };
