function escapeHtml(unsafe)
{
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

let xmlDoc = null;


function openTab(evt, tabName) {
    var i, tabcontent, tablinks;

    // Hide all tab content
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Remove the active class from all tab links
    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab content and add the active class to the button that opened the tab
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

function validateNumber(input) {
    // Get the input value
    var value = input.value;

    // Regular expression to match real numbers (positive, negative, or decimal)
    var regex = /^-?\d*\.?\d+$/;

    // Check if the input matches the regex
    if (regex.test(value) ) {
        input.classList.remove("invalid"); // Remove invalid class
    } else {
        input.classList.add("invalid"); // Add invalid class
    }

    // If the input is empty, remove the invalid class
    if (value === "") {
        input.classList.remove("invalid");
    }
}



function parseWMSCapabilities(xmlText) {
    //  Parse the XML string into a document
    const parser = new DOMParser();
    xmlDoc = parser.parseFromString(xmlText, "text/xml");
    

    //  Extract Layers
    const layers = xmlDoc.getElementsByTagName("Layer");
    const layerDropdown = document.getElementById("layer-dropdown");
    layerDropdown.innerHTML = '<option value="" disabled selected>Select a layer</option>'; // Reset dropdown

    for (let i = 1; i < layers.length; i++) { // Skip first Layer (it's usually the root)
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

    const crsDropdown = document.getElementById("crs-dropdown");
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

    //  Extract Output Formats
    const getMapNode = xmlDoc.querySelector("Capability > Request > GetMap");

    // Fetch <Format> tags inside <GetMap>
    if (getMapNode) {
        const formats = getMapNode.getElementsByTagName("Format");

    //const formats = xmlDoc.getElementsByTagName("Format");
    const formatDropdown = document.getElementById("format-dropdown");
    formatDropdown.innerHTML = '<option value="" disabled selected>Select Output Format</option>'; // Reset dropdown

    for (let format of formats) {
        let formatValue = format.textContent;
        if (formatValue) {
            let option = document.createElement("option");
            option.value = formatValue;
            option.textContent = formatValue;
            formatDropdown.appendChild(option);
        }
    }
    }
}


async function fetchAndRegisterCRS(crsCode) {

    const epsgCode = crsCode.replace("EPSG:", ""); // Extract the numeric code
    const epsgUrl = `https://epsg.io/${epsgCode}.proj4`;
    console.log(epsgUrl);

    try {
        const response = await fetch(epsgUrl);
        if (!response.ok) throw new Error(`Failed to fetch CRS definition for ${crsCode}`);
//        console.log(response);
        const proj4Definition = await response.text();
        console.log(`Registering CRS: ${crsCode} → ${proj4Definition}`);

        proj4.defs(crsCode, proj4Definition);
        ol.proj.proj4.register(proj4);
    } catch (error) {
        console.error("Error registering CRS:", error);
        alert(`Error: Could not fetch definition for ${crsCode}`);
    }
}


async function handleChange(which){

    let selectedLayer = document.getElementById("layer-dropdown").value;

    if (!xmlDoc) return; // If XML is not loaded yet, do nothing

    //  Find the selected layer in the XML
    const layers = xmlDoc.getElementsByTagName("Layer");
    for (let i = 1; i < layers.length; i++) { // Skip root layer
        let name = layers[i].getElementsByTagName("Name")[0]?.textContent;
        if (name === selectedLayer) {
            //  Fetch BBOX for this layer
            let bboxNode = layers[i].getElementsByTagName("LatLonBoundingBox")[0];
            if (!bboxNode) {
                bboxNode = layers[i].getElementsByTagName("EX_GeographicBoundingBox")[0];
            }

            if (bboxNode) {
                let bbox_s = [
                    bboxNode.getAttribute("minx") || bboxNode.getElementsByTagName("westBoundLongitude")[0]?.textContent || "", // minx
                    bboxNode.getAttribute("miny") || bboxNode.getElementsByTagName("southBoundLatitude")[0]?.textContent || "", // miny
                    bboxNode.getAttribute("maxx") || bboxNode.getElementsByTagName("eastBoundLongitude")[0]?.textContent || "", // maxx
                    bboxNode.getAttribute("maxy") || bboxNode.getElementsByTagName("northBoundLatitude")[0]?.textContent || ""  // maxy
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
                
                const userCRS = document.getElementById("crs-dropdown").value;
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
                
                let transformedBBOX = ol.proj.transformExtent(bbox, "EPSG:4326", document.getElementById("crs-dropdown").value );
                
                console.log(transformedBBOX);
  
                
                document.getElementById("number11").value = transformedBBOX[0];
                document.getElementById("number22").value = transformedBBOX[2];
                document.getElementById("number111").value = transformedBBOX[1];
                document.getElementById("number222").value = transformedBBOX[3];
                
            }
            break; // Stop searching once the correct layer is found
        }
    }
}


document.getElementById("crs-dropdown").addEventListener("change", async function () {
    await handleChange(0);
});

document.getElementById("layer-dropdown").addEventListener("change", async function () {
    await handleChange(1);
});



function wmsGetCapabilities() {
    const server = document.getElementById("field1").value ? document.getElementById("field1").value : document.getElementById("field1").placeholder;
    
    // const server = "http://10.142.133.112:9090/geoserver"

    const url = `${server}/wms?request=getCapabilities`;
//    const url = `${server}/?service=wms&&request=getCapabilities`;

            
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
//        console.log("Response text:", text); // Log the response text
        document.getElementById('xml-display').innerHTML = 
            `<pre>${escapeHtml(text)}</pre>`
        ;
        
        parseWMSCapabilities(text);
        
    })
    .catch(error => {
//        console.error('Error fetching WMS capabilities:', error);
        document.getElementById('xml-display').innerHTML = 
            `<h2>Error</h2>
            <pre>${escapeHtml(error.message)}</pre>`
        ;
    });
}

function fetchAndDownloadImage(url, format) {
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch image.");
            return response.blob();
        })
        .then(blob => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `GetMap_Image.${format.split("/")[1]}`; // Extract file extension from MIME type
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(error => console.error("Error downloading image:", error));
}

function fetchAndDisplayTIFF(url) {
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch TIFF image.");
            return response.blob();
        })
        .then(blob => {
            const tiffUrl = URL.createObjectURL(blob);
            let bbox = [
                parseFloat(document.getElementById("number11").value), // minx
                parseFloat(document.getElementById("number111").value), // miny
                parseFloat(document.getElementById("number22").value), // maxx
                parseFloat(document.getElementById("number222").value)  // maxy
            ];
            
            let transformedBBOX = ol.proj.transformExtent(bbox, document.getElementById("crs-dropdown").value, "EPSG:3857" )
            
            // Add new raster layer to OpenLayers map
            const tiffLayer = new ol.layer.Image({
                source: new ol.source.ImageStatic({
                    url: tiffUrl,
                    imageExtent: bbox,
                    projection: document.getElementById("crs-dropdown").value
                })
            });

            // Add layer to map
            map.addLayer(tiffLayer);
            
            map.getView().fit(transformedBBOX, { duration: 1000 });
        })
        .catch(error => console.error("Error displaying TIFF:", error));
}


// Display the first tab by default
document.getElementById("Tab1").style.display = "block";
document.getElementsByClassName("tablink")[0].className += " active";
document.getElementById('wms-getcapabilities').addEventListener('click', wmsGetCapabilities );

document.getElementById("wms-submit").addEventListener("click", function () {

    // Get user inputs
    const layer = document.getElementById("layer-dropdown").value;
    const crs = document.getElementById("crs-dropdown").value;
    const format = document.getElementById("format-dropdown").value;
    const width = document.getElementById("number1").value;
    const height = document.getElementById("number2").value ;
    const server = document.getElementById("field1").value ? document.getElementById("field1").value : document.getElementById("field1").placeholder;
    //console.log(server);

    // const server = "http://10.142.133.112:9090/geoserver"

    let bbox = [
        document.getElementById("number11").value, // minx
        document.getElementById("number111").value, // miny
        document.getElementById("number22").value, // maxx
        document.getElementById("number222").value  // maxy
    ];
    
    //let transformedBBOX = ol.proj.transformExtent(bbox, "EPSG:4326", crs ).join(",");

    if (!layer || !crs || !format || !bbox || !width || !height) {
        alert("Please fill all required fields!");
        return;
    }

//http://127.0.0.1:8080/geoserver/wms?bbox=16011619.366020126,-4858879.368036289,16528622.369542673,-4405345.394828512&styles=&Format=image/png&request=GetMap&layers=tasmania&width=550&height=250&srs=EPSG:4087
    // Construct GetMap URLs
    const baseUrl = `${server}/wms?`;
    const commonParams = `service=WMS&version=1.1.1&request=GetMap&layers=${layer}&styles=&bbox=${bbox}&width=${width}&height=${height}&crs=${crs}`;

    const requestedFormatUrl = `${baseUrl}${commonParams}&format=${format}`;

    const tiffFormatUrl = `${baseUrl}${commonParams}&format=image/tiff`;
    
    console.log(requestedFormatUrl);
    
    //  Fetch both images
    fetchAndDownloadImage(requestedFormatUrl, format); // Download requested format
    fetchAndDisplayTIFF(tiffFormatUrl); // Display TIFF on map
});
