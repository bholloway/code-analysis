"use strict";

var fs     = require('fs');
var stream = require('stream');

/**
 * <p>Given a stream of file names will detect [WebMethod]s in those files.</p>
 * @returns {Stream.Transform} A stream of results <code>{ namespace, definition, response, method, request }</code>
 */
function webmethodMatcher()
{
  var transform = new stream.Transform({
    objectMode: true
  });
  transform._transform = function(chunk, encoding, done) {
    var transform = this;

    // process file
    var fileName = String(chunk);
    fs.readFile(fileName, function (err, data) {
      const IDLE        = null;
      const NAMESPACE   = /^\s*namespace\s+([\w\.]+)\s*(?:\{\s*)?$/              // namespace Some.Name.Space [{]
      const DEFINITION  = /^\s*public\s+(?:partial\s+)?class\s+(\w+).*$/;        // public [partial] class Class ...
      const METADATA    = /^\s*\[WebMethod.*\]\s*$/;                             // [WebMethod]
      const DECLARATION = /^\s*public\s+(\w+)\s+(\w+)\((?:(\w+)\s+\w+)?\)\s*$/;  // public Response SomeMethod(Request x)

      // error implies error to callback
      if (err) {
        done(new Error('error reading file: "' + fileName + '"'));

      // process each line
      } else {
        var lines      = String(data).split(/[\r\n]+/);
        var state      = IDLE;
        var ns         = null;
        var definition = null;
        for(var i = 0; i < lines.length; i++) {
          var line = lines[i];

          // detect current state based on the current line
          switch (state) {
            case IDLE:
              state =
                NAMESPACE.test(line) ? NAMESPACE :
                DEFINITION.test(line) ? DEFINITION :
                METADATA.test(line) ? METADATA :
                IDLE;
              break;
            case METADATA:
              state =
                DECLARATION.test(line) ? DECLARATION :
                IDLE;
              break;
            default:
              state = IDLE;
              break;
          }

          // act for the current state
          switch (state) {
            case NAMESPACE:
              ns = NAMESPACE.exec(line)[1];
              break;
            case DEFINITION:
              definition = DEFINITION.exec(line)[1];
              break;
            case DECLARATION:
              var analysis = DECLARATION.exec(line);
              transform.push({
                namespace:  ns,
                definition: definition,
                response:   analysis[1],
                method:     analysis[2],
                request:    analysis[3]
              });
              break;
          }
        }
        done();
      }
    });
  };
  return transform;
}

module.exports = webmethodMatcher;