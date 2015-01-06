var stream = require('stream');
var json   = require('format-json');

/**
 * <p>Transform an incoming object to text representation.</p>
 * @returns {Stream.Transform}
 */
function objectToString()
{
  var transform = new stream.Transform({
    objectMode: true
  });
  transform._transform = function(chunk, encoding, done) {
    this.push(json.plain(chunk), '\n');
    done();
  }
  return transform;
}

module.exports = objectToString;