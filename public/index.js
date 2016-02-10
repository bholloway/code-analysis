/* globals d3, _ */

(function(element) {
  "use strict";

  d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
      this.parentNode.appendChild(this);
    });
  };
  d3.selection.prototype.contains = function(candidate) {
    var isFound = false;
    (function test(arg) {
      if ("length" in arg) {
        for (var i = 0; !(isFound) && (i < arg.length); i++) {
          test(arg[i]);
        }
      } else {
        isFound = isFound || (arg === candidate);
      }
    })(this);
    return isFound;
  };

  var WIDTH     = element.clientWidth;
  var HEIGHT    = element.clientHeight;
  var BOUND     = Math.min(WIDTH, HEIGHT);
  var RADIUS    = BOUND * 0.4;
  var COLOUR    = d3.scale.category20c();
  var THICKNESS = RADIUS * 0.04;

  var diagram = d3.select(element)
    .append("div")
    .style({
      "position": "absolute",
      "width":    String(HEIGHT) + "px",
      "height":   "100%",
      "overflow": "hidden"
    })
    .on("click", click);

  var info = d3.select(element)
    .append("div")
    .style({
      "position": "absolute",
      "left":     String(HEIGHT) + "px",
      "right":    0,
      "top":      0,
      "bottom":   0,
      "margin":   0,
      "padding":  0,
      "overflow": "auto"
    });

  var infoA = info
    .append("ul")
    .style({
      "position":        "absolute",
      "height":          "2em",
      "margin":          0,
      "padding":         0,
      "list-style-type": "none"
    });

  var infoB = info
    .append("ul")
    .style({
      "position":        "absolute",
      "top":             "2em",
      "bottom":          0,
      "margin":          0,
      "padding":         0,
      "list-style-type": "none"
    });

  var chart = diagram
    .append("svg")
    .append("g")
    .attr("transform", "translate(" + HEIGHT * 0.5 + "," + HEIGHT * 0.5 + ")");

  var circle = d3.svg.arc()
    .startAngle(0)
    .endAngle(2 * Math.PI)
    .innerRadius(0)
    .outerRadius(BOUND * 0.5);
  var matt = chart
    .append("path")
    .attr("d", circle)
    .attr("opacity", 0.0);

  var rotated = chart
    .append("g")
    .attr("transform", "rotate(200)");

  var highlightInfo = chart
    .append("g")
    .append("text")
    .attr("width", 2 * (RADIUS - 10))
    .attr("font-weight", "bold")
    .attr("text-anchor", "middle");

  var sunburstPaths;
  var linkPaths;

  d3.json("data.json", function (list) {

    var cluster = d3.layout.cluster()
      .size([ 360, RADIUS ])
      .sort(function (a, b) { return d3.ascending(a.key, b.key); });

    var partition = d3.layout.partition()
      .sort(null)
      .size([ 2 * Math.PI, RADIUS * RADIUS * 0.25 ]) // x is angle, y is area
      .value(function (d) { return 1; });

    var root    = getRoot(list);
    var flat    = flatten(root);
    var nodes   = cluster.nodes(flat);
    var links   = getLinks(nodes, list);
    var splines = d3.layout.bundle()(links);

    var arc     = d3.svg.arc()
      .startAngle(function (d) { return d.x; })
      .endAngle(function (d) { return d.x + d.dx; })
      .innerRadius(function (d) { return RADIUS + (d.depth - 1) * THICKNESS; })
      .outerRadius(function (d) { return RADIUS + d.depth * THICKNESS; });

    var line    = d3.svg.line.radial()
      .interpolate("bundle")
      .tension(0.9)
      .radius(function (d) { return d.y; })
      .angle(function (d) { return d.x / 180 * Math.PI; });

    rotated
      .on("mouseover", chartOver)
      .on("mouseleave", chartLeave);

    sunburstPaths = rotated
      .append("g")
      .attr('id', 'sunburst')
      .datum(root)
      .selectAll("path")
      .data(partition.nodes)
      .enter()
      .append("g")
      .attr("display", function (d) { return d.depth ? null : "none"; }) // hide root
      .append("path");
    sunburstPaths
      .attr("d", arc)
      .on("mouseover", sunburstOver)
      .on("mouseleave", sunburstLeave)
      .on("click", sunburstClick)
      .style("stroke", "#fff")
      .style("fill", function (d) { return COLOUR((d.children ? d : d.parent).name); })
      .style("fill-rule", "evenodd");

    linkPaths = rotated
      .append("g")
      .attr('id', 'links')
      .selectAll("path.link")
      .data(links)
      .enter()
      .append("path");
    linkPaths
      .attr("d", function (d, i) { return line(splines[i]); })
      .style("fill", "none")
      .style("opacity", 0.5)
      .style("stroke-width", 1)
      .style("stroke", "#99F");
  });

  function getRoot(list) {
    var getNode = _.memoize(function (name, children) {
      var node = { name: name, children: children };
      children && children.forEach(function (child) {
        child.parent = node;
      });
      return node;
    });
    var root = getNode('root', [
      getNode('client'),
      getNode('webmethod')
    ]);

    function splitFilenames(name, root) {
      var split   = name.split(/([\\/\.\:]+)/g);
      var subtree = (split.length === 1) ? root : splitFilenames(split.slice(0, -2).join(""), root);
      var node    = getNode(name);
      var list    = subtree.children = subtree.children || [ ];
      node.parent = subtree;
      if (list.indexOf(node) < 0) {
        list.push(node);
      }
      return node;
    }

    list.forEach(function (item) {
      splitFilenames(item.client, getNode('client'));
      item.webmethods && item.webmethods.forEach(function (webmethod) {
        splitFilenames(webmethod, getNode('webmethod'));
      });
    });

    (function collapseUnaryChildren(node) {
      while ((node.children) && (node.children.length === 1)) {
        var child = node.children[0];
        node.name     = child.name;
        node.children = child.children;
      }
      node.children && node.children.forEach(collapseUnaryChildren);
    })(root);

    return root;
  }

  function flatten(node) {
    var copy = { name: node.name };
    node.children && node.children.forEach(function(child) {
      var recursed = flatten(child).children;
      copy.children = (copy.children || [ ]).concat(recursed || { name: child.name });
    });
    copy.children && copy.children.forEach(function(child) {
      child.parent = copy;
    });
    return copy;
  }

  function getLinks(nodes, list) {
    var lookup  = {};
    var results = [];
    nodes.forEach(function(node) {
      lookup[node.name] = node;
    });
    list.forEach(function(item) {
      var source = lookup[item.client];
      item.webmethods && item.webmethods.forEach(function(webmethod) {
        var target = lookup[webmethod];
        results.push({ source: source, target: target });
      });
    });
    return results;
  }

  function getAncestors(node) {
    var results = [ ];
    var nodes   = Array.prototype.slice.call(arguments, 0);
    for (var i = 0; i < nodes.length; i++) {
      var current = nodes[i];
      while (current.parent) {
        results.push(current);
        current = current.parent;
      }
    }
    return results;
  }

  function getLeafNodes(node) {
    var results = [ ];
    var nodes   = Array.prototype.slice.call(arguments, 0);
    for (var i = 0; i < nodes.length; i++) {
      node = nodes[i];
      if (node.children) {
        node.children.forEach(function(child) {
          results.push.apply(results, getLeafNodes(child));
        });
      } else {
        results.push(node);
      }
    }
    return results;
  }

  function getName(node) {
    return (node) ? node.name : null;
  }

  function getLinkedLeaves(node) {
    var nodes   = Array.prototype.slice.call(arguments, 0);
    var names   = nodes.map(getName);
    var related = [ ];
    var i, j;

    // trace links
    linkPaths.each(function(d) {
      var items = [ d.source, d.target ];
      for (var j = 0; j < 2; j++, items.reverse()) {
        if (items[0] && items[1] && (names.indexOf(items[0].name) >= 0) && (related.indexOf(items[1].name) < 0)) {
          related.push(items[1].name);
        }
      }
    });

    // return sunburst nodes
    var results = [ ];
    sunburstPaths.each(function(d) {
      (related.indexOf(d.name) >= 0) && results.push(d);
    });
    return results;
  }

  var isOverChart = false;
  var isOverTimeout;

  function chartOver() {
    /* jshint validthis:true */
    clearTimeout(isOverTimeout);
    if (!(isOverChart) && (rotated.contains(this))) {
      isOverChart = true;

      // only where there is no highlight
      if (!linkPathsHighlight) {
        fadeSunburst();
        fadeLinks();
      }
    }
  }

  function chartLeave() {
    /* jshint validthis:true */
    if ((isOverChart) && (rotated.contains(this))) {
      isOverChart = false;
      clearTimeout(isOverTimeout);

      // only where there is no highlight
      if (!linkPathsHighlight) {
        isOverTimeout = setTimeout(function () {
          unfadeSunburst();
          unfadeLinks();
          clearInfo();
          isOverTimeout = null;
        }, 1000);
      }
    }
  }

  function click() {
    clearTimeout(isOverTimeout);
    if (!isOverChart) {
      sunburstPathsOver      = null;
      sunburstPathsHighlight = null;
      linkPathsHighlight     = null;
      unfadeSunburst();
      unfadeLinks();
      clearInfo();
    }
  }

  var sunburstPathsOver;
  var sunburstPathsHighlight;
  var linkPathsHighlight;

  function sunburstOver(d) {
    /* jshint validthis:true */
    sunburstPathsOver = d3.select(this);
    highlightSunburst(sunburstPathsOver);
    highlightInfo.text(d.name);
  }

  function sunburstLeave() {
    sunburstPathsOver && fadeSunburst(sunburstPathsOver.filter(function(d) {
      return !(sunburstPathsHighlight) || !(sunburstPathsHighlight.contains(this));
    }));
    highlightInfo.text("");
  }

  function sunburstClick(d) {
    var leafNodes         = getLeafNodes(d);
    var leafAncestorNames = getAncestors.apply(null, leafNodes).map(getName);
    var linkedLeaves      = getLinkedLeaves.apply(null, leafNodes);
    var allAncestors      = getAncestors.apply(null, leafNodes.concat(linkedLeaves));
    
    // sunburst
    sunburstPathsHighlight && fadeSunburst(sunburstPathsHighlight.filter(function(d) {
      return !(sunburstPathsOver) || !(sunburstPathsOver.contains(this));
    }));
    sunburstPathsHighlight = sunburstPaths.filter(function(d) {
      return (allAncestors.indexOf(d) >= 0);
    });
    highlightSunburst(sunburstPathsHighlight);
    
    // links
    linkPathsHighlight && fadeLinks(linkPathsHighlight);
    linkPathsHighlight = linkPaths.filter(function(d) {
      return ((leafAncestorNames.indexOf(d.source.name) >= 0) ||
        (leafAncestorNames.indexOf(d.target.name) >= 0));
    });
    highlightLinks(linkPathsHighlight);
    
    // info
    highlightInfo.text("");
    setInfo([ d.name ], [ linkedLeaves.length ].concat(linkedLeaves.map(getName)));
  }

  function fadeSunburst(selection) {
    (selection || sunburstPaths)
      .style("opacity", 0.15)
      .style("stroke", "#444");
  }
  function fadeLinks(selection) {
    (selection || linkPaths)
      .style("opacity", 0.15)
      .style("stroke-width", 1)
      .style("stroke", "#CCC");
  }

  function unfadeSunburst(selection) {
    (selection || sunburstPaths)
      .style("opacity", 1.0)
      .style("stroke", "#FFF");
  }
  function unfadeLinks(selection) {
    (selection || linkPaths)
      .style("opacity", 0.5)
      .style("stroke-width", 1)
      .style("stroke", "#99F");
  }

  function highlightSunburst(selection) {
    (selection || sunburstPaths)
      .style("opacity", 1.0)
      .style("stroke", "#444")
      .moveToFront();
  }
  function highlightLinks(selection) {
    (selection || linkPaths)
      .style("opacity", 1.0)
      .style("stroke-width", 1.5)
      .style("stroke", "#99F")
      .moveToFront();
  }

  function clearInfo() {
    [ infoA, infoB ].forEach(function(selection) {
      selection
        .selectAll("li")
        .remove();
    });
  }

  function setInfo() {
    clearInfo();
    (function(dataSets) {
      setTimeout(function() {
        [ infoA, infoB ].forEach(function(selection, i) {
          if (dataSets[i]) {
            selection
              .selectAll("li")
              .data(dataSets[i])
              .enter()
              .append("li")
              .text(function (d) { return d; });
          }
        });
      }, 0);
    })(arguments);
  }

})(document.body);