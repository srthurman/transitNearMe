var buffer = require('turf-buffer');
var within = require('turf-within');
var fc = require('turf-featurecollection');
var point = require('turf-point');

var $ = require('jquery');

var baseURI = window.location.href;
var currentRadius = 0;

L.mapbox.accessToken = 'pk.eyJ1Ijoic3J0aHVybWFuIiwiYSI6IkVGXy1NMHcifQ.EouINDEZGzjGs0x0VMhHxg';

var map = L.mapbox.map('map','srthurman.n9l71i86')
    .setView([38.901078, -77.024361], 14);
    
var wmataRoutes = L.mapbox.featureLayer()
    .loadURL(baseURI+'wmataRoutes')
    //.addTo(map);
    
var marker = L.marker(new L.LatLng(38.901078, -77.024361), {
    icon: L.mapbox.marker.icon({
        "marker-color": "#FF00FF",
        "title": "You need coffee",
        "marker-symbol": "pitch",
        "marker-size": "large"
    }),
    draggable: true,
    zIndexOffset:999
}).addTo(map);


var metro;
var cabi;

var loadWmata = $.get(baseURI+'wmataStops', function(data) {
        metro = data;
    });
    
var loadCabi = $.get(baseURI+'cabi', function(data) {
        cabi = data;
    });
    
$.when(loadWmata, loadCabi).done(function() {
    //click-move functionality
    map.on('click',function(e){
        marker.setLatLng([e.latlng.lat, e.latlng.lng]);
        map.setView([e.latlng.lat, e.latlng.lng],14);
        updateTransitPoints();
    });
    
    // get position, get radius, draw buffer, find within, add to map
    function updateTransitPoints(){
        $('#tallies svg').remove();
        $('path').remove();
        $('.leaflet-marker-pane *').not(':first').remove();
        var position=marker.getLatLng();
        var pt=point([position.lng, position.lat]);

        //draw buffer
        var bufferLayer = L.mapbox.featureLayer().addTo(map);
        
        var transitBuffer = buffer(pt, currentRadius, 'miles');
        transitBuffer.properties = {
            "fill": "#00704A",
            "fill-opacity":0.05,
            "stroke": "#00704A",
            "stroke-width": 2,
            "stroke-opacity": 0.5
        };
        
        bufferLayer.setGeoJSON(transitBuffer);
        
        //load stops and filter based on buffer
        var filteredStops = L.mapbox.featureLayer().addTo(map);
        var bufferFC = fc([transitBuffer]);
        var stops = within(metro, bufferFC);
        
        var metroStops = [];
        for (var s=0,l=stops.features.length;s<l;s++) {
            var currStop = stops.features[s];
            
            var str = currStop['name'];
            var re = /metro station/i;
            var found = str.match(re);
            if (found) {
                currStop.properties["marker-color"] = "#666";
                currStop.properties["marker-size"] = "large";
                currStop.properties["marker-symbol"] = "m";
                metroStops.push(currStop);
            };
        }
        filteredStops.setGeoJSON(fc([metroStops]).features[0]);
        
        
        var cabiStations = [];
        
        for (var c=0, l=cabi.length;c<l;c++) {
            var station = cabi[c]
            cabiStations.push(point([station.long[0],station.lat[0]],
                {"name": station.name[0],
                "currBikes": station.nbBikes[0],
                "marker-color": "#E60000",
                "marker-size": "medium",
                "marker-symbol": "bicycle"
                }));
        }
        //var cabiFC = fc(cabiStations);
        var filteredCabi = L.mapbox.featureLayer().addTo(map);
        var cabiFC = fc(cabiStations);
        var cabis = within(cabiFC, bufferFC);
        filteredCabi.setGeoJSON(cabis);
        
        var cabiStationCount = cabis.features.length;
        var cabiBikeCount = 0;
        var cabiStationBikeCount = [];
        for (var b=0,l=cabis.features.length;b<l;b++) {
            var station = cabis.features[b];
            var bikeCount = Number(station.properties.currBikes);
            cabiBikeCount += bikeCount;
            cabiStationBikeCount.push(bikeCount);
        }
        
        var metroStopCount = metroStops.length;
        var busStopCount = stops.features.length - metroStopCount;
        
        $('#busStopTally').html(busStopCount);
        $('#cabiStationTally').html(cabiStationCount);
        $('#cabiBikesTally').html(cabiBikeCount);
        
        ////D3 to create charts
        transitViz(cabiStationCount, cabiStationBikeCount, metroStopCount, busStopCount);
    }
    
    function transitViz(bikeStations, bikes, metro, bus) {
        ///metro styling
        $('.trainImg').remove();
        if (metro === 0) {
            var noTrain = '<img class="trainImg" src="img/close.svg" alt="no train icon">';
            $('#metroStopTally').append(noTrain);
        } else {
            var train = '<img class="trainImg" src="img/train.svg" alt="train icon">';
            for (var m=1;m<=metro;m++) {
                $('#metroStopTally').append(train);
            }
        }
        
        ///bike styling
        var w = $("#tallies").width();
        var h = $("#sidebar").height()/6;
        var padding = 2;
        var bikeDataset = bikes.sort(function(a, b){return a-b}).reverse();
        
        var xScale = d3.scale.linear()
            .domain([0,bikeDataset.length])
            .range([0,w]);
            
        var yScale = d3.scale.linear()
            .domain([0,d3.max(bikeDataset)])
            .range([h,0]);

        var svg = d3.select("#bikeChart").append("svg")
            .attr("width", w)
            .attr("height",h);

        svg.selectAll("rect")
            .data(bikeDataset)
            .enter()
            .append("rect")
                .attr("x", function(d, i) {
                    //return i * (w/dataset.length);
                    console.log(xScale(i));
                    return xScale(i);
                })
                .attr("y", function(d) {
                    console.log(yScale(d));
                    return yScale(d);
                })
                .attr("width", w/bikeDataset.length - padding)
                .attr("height", function(d) {
                    console.log(h - yScale(d));
                    return h - yScale(d);
                })
                .attr("fill", "blue");
    }
    
    ///Update radius
    function updateRadius() {
       var val = $('#radiusSelect').val();
       $("#radiusVal").val(val);
       
       currentRadius = Number(val)/20;
       updateTransitPoints();
    }
    
    $('#radiusSelect').change(function() {
       updateRadius();
    });

    marker.on('drag', function(){updateTransitPoints()});
    updateRadius();
    //updateTransitPoints();
});