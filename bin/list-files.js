var fs     = require('fs');
var fs     = require('fs');
var fs     = require('fs');
var path   = require('path');
var stream = require('stream');

/**
 * <p>Stream filenames recursively from the given directory that match the name patter.</p>
 * @param {RegExp} baseDirectory An absolute path to search recursively
 * @param {RegExp} namePattern A pattern to match file names
 * @returns {stream.Readable} A stream of file names
 */
function listFiles(baseDirectory, namePattern)
{
  namePattern = namePattern || new RegExp();
  var results = stream.Readable();
  var queue   = (baseDirectory) ? [ baseDirectory ] : [ ];
  results._read = function () {
    (function dequeue() {
      if (queue.length) {
        var candidate = queue.shift();
        fs.lstat(candidate, function (err, stat) {

          // error implies continue
          if (err) {
            dequeue();
          } else {

            // get the directory list
            //  continue regardless of error
            if (stat.isDirectory()) {
              fs.readdir(candidate, function(err, names) {
                if (!err) {
                  queue.push.apply(queue, names.map(function(value){
                    return candidate + "/" + value;
                  }));
                }
                dequeue();
              });

            // matching file
            } else if (stat.isFile() && namePattern.test(candidate)) {
              results.push(candidate);

            // other implies continue
            } else {
              dequeue();
            }
          }
        });

      } else {
        return results.push(null);
      }
    })();
  }
  return results;
}
module.exports = listFiles;