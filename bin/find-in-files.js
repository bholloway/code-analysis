var fs     = require('fs');
var stream = require('stream');

/**
 * <p>Execute a regular expression line-by-line on the contents of each file in a stream.</p>
 * @param {RegExp} filePattern A regex whose capture groups determine the <code>file</code> field
 * @param {RegExp} findPattern A regex whose <code>exec()</code> determines the <code>match</code> field
 * @returns {Stream.Transform} A stream that transforms file names into <code>{ file, match }</code<
 */
function findInFiles(filePattern, findPattern)
{
  var transform = new stream.Transform({
    objectMode: true
  });
  transform._transform = function(chunk, encoding, done) {
    var transform = this;

    // file parameters
    var fileName = String(chunk);
    var analysis = (filePattern) ? filePattern.exec(fileName) : null;
    if (analysis) {
      var file = analysis.slice(1).join("/");

      // process file
      fs.readFile(fileName, function (err, data) {

        // error implies error to callback
        if (err) {
          done(new Error('error reading file: "' + fileName + '"'));

        // process each line
        } else {
          var lines = String(data).split(/[\r\n]+/);
          for (var i = 0; i < lines.length; i++) {
            var line  = lines[i];
            var match = findPattern.exec(line);
            if (match) {
              transform.push({
                file:   file,
                match:  match
              });
            }
          }
          done();
        }
      });

    // ignore filename
    } else {
      done();
    }
  }
  return transform;
}

module.exports = findInFiles;