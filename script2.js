// function escapeHtml(unsafe)
// {
//     return unsafe
//          .replace(/&/g, "&amp;")
//          .replace(/</g, "&lt;")
//          .replace(/>/g, "&gt;")
//          .replace(/"/g, "&quot;")
//          .replace(/'/g, "&#039;");
//  }

let xmlDoc_f = null;



function parseWFSCapabilities(xmlText) {
    //  Parse the XML string into a document
    const parser = new DOMParser();
    xmlDoc_f = parser.parseFromString(xmlText, "text/xml");
    

    //  Extract Layers
    const layers = xmlDoc_f.getElementsByTagName("FeatureType");
    const layerDropdown = document.getElementById("layer_dropdown_f");
    layerDropdown.innerHTML = '<option value="" disabled selected>Select a Feature</option>'; // Reset dropdown

    for (let i = 0; i < layers.length; i++) { 
        let name = layers[i].getElementsByTagName("Name")[0]?.textContent;
        let title = layers[i].getElementsByTagName("Title")[0]?.textContent;
        if (name) {
            let option = document.createElement("option");
            option.value = name;
            option.textContent = title || name;
            layerDropdown.appendChild(option);
        }
    }

    //  Extract CRS (Spatial Reference Systems)

    const crsDropdown = document.getElementById("crs_dropdown_f");
    crsDropdown.innerHTML = ''; // Clear previous options

    const crsOptions = [
        { code: "EPSG:4326", name: "WGS 84 (Lat/Lon)" },
        { code: "EPSG:3857", name: "Web Mercator" },
        { code: "EPSG:3395", name: "World Mercator" },
        { code: "EPSG:54009", name: "Mollweide" },
        { code: "EPSG:4087", name: "NSIDC EASE-Grid 2.0" },
        { code: "EPSG:32662", name: "WGS 84 / World Equidistant Cylindrical" }
    ];

    //  Add "Select CRS" option first
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select CRS";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    crsDropdown.appendChild(defaultOption);

    //  Add predefined CRS options
    crsOptions.forEach(crs => {
        let option = document.createElement("option");
        option.value = crs.code;
        option.textContent = `${crs.code} - ${crs.name}`;
        crsDropdown.appendChild(option);
    });
    


    const operationNode = [...xmlDoc_f.getElementsByTagName("ows:Operation")]
        .find(node => node.getAttribute("name") === "GetFeature");

    if (!operationNode) {
        console.error("<ows:Operation name='GetFeature'> not found!");
        return [];
    }

    // console.log(operationNode);

    // Find <ows:Parameter> with name="outputFormat" inside <ows:Operation>
    const outputFormatNode = [...operationNode.getElementsByTagName("ows:Parameter")]
        .find(param => param.getAttribute("name") === "outputFormat");

    if (!outputFormatNode) {
        console.error("<ows:Parameter name='outputFormat'> not found!");
        return [];
    }

    // console.log(outputFormatNode);

    // Extract all <ows:Value> elements inside <ows:Parameter>
    const values = [...outputFormatNode.getElementsByTagName("ows:Value")];
    const formats = values.map(value => value.textContent.trim());

    // console.log(formats);

    const formatDropdown = document.getElementById("format_dropdown_f");
    formatDropdown.innerHTML = '<option value="" disabled selected>Select Output Format</option>'; // Reset dropdown

    for (let format of formats) {
        if (format) {
            let option = document.createElement("option");
            option.value = format;
            option.textContent = format;
            formatDropdown.appendChild(option);
        }
    }
    
}


async function handleChange_f(which){
    let selectedLayer = document.getElementById("layer_dropdown_f").value;

    if (!xmlDoc_f) return; // If XML is not loaded yet, do nothing

    //  Find the selected layer in the XML
    const layers = xmlDoc_f.getElementsByTagName("FeatureType");
    for (let i = 1; i < layers.length; i++) { // Skip root layer
        let name = layers[i].getElementsByTagName("Name")[0]?.textContent;
        if (name === selectedLayer) {
            //  Fetch BBOX for this layer
            let bboxNode = layers[i].getElementsByTagName("ows:WGS84BoundingBox")[0];
            // if (!bboxNode) {
            //     bboxNode = layers[i].getElementsByTagName("EX_GeographicBoundingBox")[0];
            // }

            if (bboxNode) {
                let bbox_s = [
                    bboxNode.getElementsByTagName("ows:LowerCorner")[0]?.textContent.split(" ")[0] || "", // minx
                    bboxNode.getElementsByTagName("ows:LowerCorner")[0]?.textContent.split(" ")[1] || "", // miny
                    bboxNode.getElementsByTagName("ows:UpperCorner")[0]?.textContent.split(" ")[0] || "", // maxx
                    bboxNode.getElementsByTagName("ows:UpperCorner")[0]?.textContent.split(" ")[1] || ""  // maxy
                ];
                
                bbox = [ parseFloat(bbox_s[0]),parseFloat(bbox_s[1]),parseFloat(bbox_s[2]),parseFloat(bbox_s[3]) ]

                if( bbox[0] < -180 )
                    bbox[0] = -180;
                if( bbox[1] < -90 )
                    bbox[1] = -90;
                if( bbox[2] > 180 )
                    bbox[2] = 180
                if( bbox[3] > 90 )
                    bbox[3] = 90;
                
                const userCRS = document.getElementById("crs_dropdown_f").value;
                if (!userCRS) {
                    if(which)
                        return;
                    else{
                        alert("Please select a CRS.");
                        return;
                    }
                }
            
                //  Check if OpenLayers already knows this CRS
                if (!ol.proj.get(userCRS)) {
                    console.log(`Fetching CRS definition for ${userCRS}...`);
                    await fetchAndRegisterCRS(userCRS);
                }
                
                console.log(ol.proj.get(userCRS));
                console.log(bbox);
                
                let transformedBBOX = ol.proj.transformExtent(bbox, "EPSG:4326", document.getElementById("crs_dropdown_f").value );
                
                console.log(transformedBBOX);
  
                
                document.getElementById("number11_f").value = transformedBBOX[0];
                document.getElementById("number22_f").value = transformedBBOX[2];
                document.getElementById("number111_f").value = transformedBBOX[1];
                document.getElementById("number222_f").value = transformedBBOX[3];
                
            }
            break; // Stop searching once the correct layer is found
        }
    }
}


document.getElementById("crs_dropdown_f").addEventListener("change", async function () {
    await handleChange_f(0);
});

document.getElementById("layer_dropdown_f").addEventListener("change", async function () {
    await handleChange_f(1);
});


function prettyPrintXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
}



function wfsGetCapabilities() {
            //const url = '${localGeoserverUrl}/${workspace}/wms?service=WMS&version=1.1.0&request=GetCapabilities';
            
    const server = document.getElementById("field1_f").value ? document.getElementById("field1_f").value : document.getElementById("field1_f").placeholder;        
    const url = `${server}/wfs?request=getCapabilities&pretty=true`;
//    const url = `${server}/?service=wfs&&request=getCapabilities&pretty=true`;
    
    fetch(url)
    .then(response => {
        console.log("Response status:", response.status); // Log the status
        console.log("Response headers:", response.headers); // Log the headers
        if (!response.ok) {
            throw new Error('HTTP error! Status: ${response.status}');
        }
        return response.text();
    })
    .then(text => {
        console.log("Response text:", vkbeautify.xml(text, 4) ); // Log the response text
        document.getElementById('xml-display').innerHTML = 
            `<pre>${ escapeHtml( vkbeautify.xml(text, 4) ) }</pre>`
        ;
        
        parseWFSCapabilities(text);
        
    })
    .catch(error => {
//        console.error('Error fetching WMS capabilities:', error);
        document.getElementById('xml-display').innerHTML = 
            `<h2>Error</h2>
            <pre>${escapeHtml(error.message)}</pre>`
        ;
    });
}

function fetchAndDownloadImage_f(url,format) {
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch image.");
            return response.blob();
        })
        .then(blob => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `GetMap_Image.${format}`; // Extract file extension from MIME type
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(error => console.error("Error downloading image:", error));
}



function fetchAndDisplayTIFF_f(url) {

    const styles = {
      'Point': new ol.style.Style({
        image: new ol.style.Circle({
          radius: 7,
          fill: new ol.style.Fill({
            color: 'rgb(68, 138, 255)',
          }),
          stroke: new ol.style.Stroke({color: '#fff', width: 4}),
        }),
      }),
      'LineString': new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'rgb(68, 138, 255)',
          width: 3,
        }),
      }),
      'MultiLineString': new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'rgb(68, 138, 255)',
          width: 3,
        }),
      }),
      'MultiPoint': new ol.style.Style({
        image: new ol.style.Circle({
          radius: 5,
          fill: null,
          stroke: new ol.style.Stroke({color: 'red', width: 1}),
        }),
      }),
      'MultiPolygon': new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'rgb(68, 138, 255)',
          width: 3,
        }),
        fill: new ol.style.Fill({
          color: 'rgba(255, 255, 255, 0.4)',
        }),
      }),
      'Polygon': new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'rgb(68, 138, 255)',
          width: 3,
        }),
        fill: new ol.style.Fill({
          color: 'rgba(255, 255, 255, 0.4)',
        }),
      }),
      'GeometryCollection': new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'rgb(68, 138, 255)',
          width: 3,
        }),
        fill: new ol.style.Fill({
          color: 'rgba(255, 255, 255, 0.4)',
        }),
        image: new ol.style.Circle({
          radius: 5,
          fill: null,
          stroke: new ol.style.Stroke({color: 'red', width: 1}),
        }),
      }),
      'Circle': new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'rgb(68, 138, 255)',
          width: 3,
        }),
        fill: new ol.style.Fill({
          color: 'rgba(255, 255, 255, 0.4)',
        }),
      }),
    };

    fetch(url)
            .then((response) => response.json())
            .then((data) => {
                console.log(data);
                // console.log(new ol.format.GeoJSON().readFeatures(data, {
                //         dataProjection: "EPSG:4326",
                //         featureProjection: "EPSG:3857",
                //     }))
                const vectorSource = new ol.source.Vector({
                    features: new ol.format.GeoJSON().readFeatures(data, {
                        dataProjection: "EPSG:4326",
                        featureProjection: "EPSG:3857",
                    }),
                });

                const vectorLayer = new ol.layer.Vector({
                    source: vectorSource,
                    style: function(feature) {
                        console.log( feature.getGeometry().getType() );
                        console.log( "Heelloo" );
                        return styles[feature.getGeometry().getType()];
                    }
                });

                map.addLayer(vectorLayer);
                map.getView().fit(vectorSource.getExtent());
            })
            .catch((error) => {
                console.error("Error fetching GeoJSON:", error);
            });

}





// http://127.0.0.1:8080/geoserver/ne/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ne%3Acoastlines&maxFeatures=50&outputFormat=application%2Fjson

document.getElementById('wfs-getcapabilities').addEventListener('click', wfsGetCapabilities );

document.getElementById("wfs-submit").addEventListener("click", function () {

    // Get user inputs
    const layerName = document.getElementById("layer_dropdown_f").value;
    const crs = document.getElementById("crs_dropdown_f").value;
    const outputFormat = document.getElementById("format_dropdown_f").value;
    const bboxMinX = document.getElementById("number11_f").value;
    const bboxMinY = document.getElementById("number111_f").value;
    const bboxMaxX = document.getElementById("number22_f").value;
    const bboxMaxY = document.getElementById("number222_f").value;
    const featureId = document.getElementById("field_feature_f").value; // Optional

    const server = document.getElementById("field1").value ? document.getElementById("field1").value : document.getElementById("field1").placeholder;
    //console.log(server);

    // const server = "http://10.142.133.112:9090/geoserver"

    
    //let transformedBBOX = ol.proj.transformExtent(bbox, "EPSG:4326", crs ).join(",");

    if (!layerName || !crs || !outputFormat || ((!bboxMinX || !bboxMinY || !bboxMaxX || !bboxMaxY) == !featureId) ) {
        alert("Please fill all required fields!");
        return;
    }


// http://localhost:8080/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=ne:disputed_areas&outputFormat=application/json&crs=EPSG:54009&bbox=-58.4273066880497,1.475362453615232,148.8371480653835,48.70561341257376,EPSG:4326&featureID=disputed_areas.1

    // Construct GetMap URLs
    const baseUrl = `${server}/wfs?`;
    const bbox_url = `${baseUrl}$service=WFS&version=2.0.0&request=GetFeature&&typeNames=${layerName}&outputFormat=${outputFormat}&crs=${crs}&bbox=${bboxMinX},${bboxMinY},${bboxMaxX},${bboxMaxY},${crs}`;

    const bbox_url_map = `${baseUrl}$service=WFS&version=2.0.0&request=GetFeature&&typeNames=${layerName}&outputFormat=application/json&crs=${crs}&bbox=${bboxMinX},${bboxMinY},${bboxMaxX},${bboxMaxY},${crs}`;

    const fid_url = `${baseUrl}$service=WFS&version=2.0.0&request=GetFeature&&typeNames=${layerName}&outputFormat=${outputFormat}&crs=${crs}&featureID=${layerName.split(":")[1]}.${featureId}`;

    const fid_url_map = `${baseUrl}$service=WFS&version=2.0.0&request=GetFeature&&typeNames=${layerName}&outputFormat=application/json&crs=${crs}&featureID=${layerName.split(":")[1]}.${featureId}`;
    //const tiffFormatUrl = `${baseUrl}${commonParams}&crs=EPSG:3857&format=image/tiff`;
    
    // console.log(requestedFormatUrl);
    
    //  Fetch both images
    if( (bboxMinX && bboxMinY && bboxMaxX && bboxMaxY) && !featureId ){
        fetchAndDownloadImage_f(bbox_url,outputFormat); // Download requested format
        fetchAndDisplayTIFF_f(bbox_url_map);
    }
    else if ( (!bboxMinX && !bboxMinY && !bboxMaxX && !bboxMaxY) && featureId ){
        fetchAndDownloadImage_f(fid_url,outputFormat);
        fetchAndDisplayTIFF_f(fid_url_map); // Display TIFF on map
    }
    else{
        alert("Please only fill one of the filters only!");
        return;
    }
});


