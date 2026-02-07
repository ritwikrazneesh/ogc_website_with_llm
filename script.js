// script.js - WMS Logic (Full Feature Set)

function escapeHtml(unsafe) {
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

    // Remove active class from tabs
    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show current tab
    document.getElementById(tabName).style.display = "block";
    
    // Handle Event Target (Click vs Programmatic)
    if (evt && evt.currentTarget) {
        evt.currentTarget.className += " active";
    } else {
        // Programmatic fallback (e.g. from AI controller)
        // Find the button that corresponds to this tabName
        for (i = 0; i < tablinks.length; i++) {
            if (tablinks[i].onclick.toString().includes(tabName)) {
                tablinks[i].className += " active";
            }
        }
    }

    // --- NEW LOGIC: Show Graph ONLY for SOS Tab ---
    const sensorResults = document.getElementById("sensor-results");
    if (tabName === "Tab3") { // Tab3 is SOS
        sensorResults.style.display = "block";
        // Scroll to it nicely
        sensorResults.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
        sensorResults.style.display = "none";
    }
}

function validateNumber(input) {
    var value = input.value;
    var regex = /^-?\d*\.?\d+$/;
    if (regex.test(value)) {
        input.classList.remove("invalid");
    } else {
        input.classList.add("invalid");
    }
    if (value === "") input.classList.remove("invalid");
}

function parseWMSCapabilities(xmlText) {
    const parser = new DOMParser();
    xmlDoc = parser.parseFromString(xmlText, "text/xml");

    // Extract Layers
    const layers = xmlDoc.getElementsByTagName("Layer");
    const layerDropdown = document.getElementById("layer-dropdown");
    
    // Default option
    layerDropdown.innerHTML = '<option value="" disabled selected>Select a layer</option>';

    for (let i = 1; i < layers.length; i++) { 
        let name = layers[i].getElementsByTagName("Name")[0]?.textContent;
        let title = layers[i].getElementsByTagName("Title")[0]?.textContent;
        if (name) {
            let option = document.createElement("option");
            option.value = name;
            option.textContent = title || name;
            layerDropdown.appendChild(option);
        }
    }

    // Extract CRS
    const crsDropdown = document.getElementById("crs-dropdown");
    crsDropdown.innerHTML = ''; 

    const crsOptions = [
        { code: "EPSG:4326", name: "WGS 84 (Lat/Lon)" },
        { code: "EPSG:3857", name: "Web Mercator" },
        { code: "EPSG:3395", name: "World Mercator" },
        { code: "EPSG:54009", name: "Mollweide" },
        { code: "EPSG:4087", name: "NSIDC EASE-Grid 2.0" },
        { code: "EPSG:32662", name: "WGS 84 / World Equidistant Cylindrical" }
    ];

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select CRS";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    crsDropdown.appendChild(defaultOption);

    crsOptions.forEach(crs => {
        let option = document.createElement("option");
        option.value = crs.code;
        option.textContent = `${crs.code} - ${crs.name}`;
        crsDropdown.appendChild(option);
    });

    // Extract Formats
    const getMapNode = xmlDoc.querySelector("Capability > Request > GetMap");
    if (getMapNode) {
        const formats = getMapNode.getElementsByTagName("Format");
        const formatDropdown = document.getElementById("format-dropdown");
        formatDropdown.innerHTML = '<option value="" disabled selected>Select Output Format</option>';

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
    const epsgCode = crsCode.replace("EPSG:", "");
    const epsgUrl = `https://epsg.io/${epsgCode}.proj4`;
    console.log(`Fetching CRS: ${epsgUrl}`);

    try {
        const response = await fetch(epsgUrl);
        if (!response.ok) throw new Error(`Failed to fetch CRS definition for ${crsCode}`);
        const proj4Definition = await response.text();
        console.log(`Registering CRS: ${crsCode}`);

        proj4.defs(crsCode, proj4Definition);
        ol.proj.proj4.register(proj4);
    } catch (error) {
        console.error("Error registering CRS:", error);
        alert(`Error: Could not fetch definition for ${crsCode}`);
    }
}

async function handleChange(which) {
    let selectedLayer = document.getElementById("layer-dropdown").value;
    if (!xmlDoc) return; 

    const layers = xmlDoc.getElementsByTagName("Layer");
    for (let i = 1; i < layers.length; i++) {
        let name = layers[i].getElementsByTagName("Name")[0]?.textContent;
        if (name === selectedLayer) {
            let bboxNode = layers[i].getElementsByTagName("LatLonBoundingBox")[0];
            if (!bboxNode) {
                bboxNode = layers[i].getElementsByTagName("EX_GeographicBoundingBox")[0];
            }

            if (bboxNode) {
                let bbox_s = [
                    bboxNode.getAttribute("minx") || bboxNode.getElementsByTagName("westBoundLongitude")[0]?.textContent || "",
                    bboxNode.getAttribute("miny") || bboxNode.getElementsByTagName("southBoundLatitude")[0]?.textContent || "",
                    bboxNode.getAttribute("maxx") || bboxNode.getElementsByTagName("eastBoundLongitude")[0]?.textContent || "",
                    bboxNode.getAttribute("maxy") || bboxNode.getElementsByTagName("northBoundLatitude")[0]?.textContent || ""
                ];
                
                let bbox = [ parseFloat(bbox_s[0]), parseFloat(bbox_s[1]), parseFloat(bbox_s[2]), parseFloat(bbox_s[3]) ];
                
                // Clamp values
                if(bbox[0] < -180) bbox[0] = -180;
                if(bbox[1] < -90) bbox[1] = -90;
                if(bbox[2] > 180) bbox[2] = 180;
                if(bbox[3] > 90) bbox[3] = 90;
                
                const userCRS = document.getElementById("crs-dropdown").value;
                if (!userCRS) {
                    if(which) return;
                    else { alert("Please select a CRS."); return; }
                }
            
                if (!ol.proj.get(userCRS)) {
                    await fetchAndRegisterCRS(userCRS);
                }
                
                let transformedBBOX = ol.proj.transformExtent(bbox, "EPSG:4326", userCRS);
                
                document.getElementById("number11").value = transformedBBOX[0];
                document.getElementById("number22").value = transformedBBOX[2];
                document.getElementById("number111").value = transformedBBOX[1];
                document.getElementById("number222").value = transformedBBOX[3];
            }
            break;
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
    const serverInput = document.getElementById("field1");
    const server = serverInput.value ? serverInput.value : serverInput.placeholder;
    const url = `${server}/wms?request=getCapabilities`;

    // CRITICAL FOR AI: Clear dropdown so LLM knows to wait for new options
    document.getElementById("layer-dropdown").innerHTML = "";

    fetch(url)
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.text();
    })
    .then(text => {
        document.getElementById('xml-display').innerHTML = `<pre>${escapeHtml(text)}</pre>`;
        parseWMSCapabilities(text);
    })
    .catch(error => {
        document.getElementById('xml-display').innerHTML = `<h2>Error</h2><pre>${escapeHtml(error.message)}</pre>`;
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
            link.download = `GetMap_Image.${format.split("/")[1]}`;
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
                parseFloat(document.getElementById("number11").value),
                parseFloat(document.getElementById("number111").value),
                parseFloat(document.getElementById("number22").value),
                parseFloat(document.getElementById("number222").value)
            ];
            
            // Add new raster layer
            const tiffLayer = new ol.layer.Image({
                source: new ol.source.ImageStatic({
                    url: tiffUrl,
                    imageExtent: bbox,
                    projection: document.getElementById("crs-dropdown").value
                })
            });

            map.addLayer(tiffLayer);
            map.getView().fit(bbox, { duration: 1000 });
        })
        .catch(error => console.error("Error displaying TIFF:", error));
}

// Initial State
document.getElementById("Tab1").style.display = "block";
if (document.getElementsByClassName("tablink")[0]) {
    document.getElementsByClassName("tablink")[0].className += " active";
}

document.getElementById('wms-getcapabilities').addEventListener('click', wmsGetCapabilities);

document.getElementById("wms-submit").addEventListener("click", function () {
    const layer = document.getElementById("layer-dropdown").value;
    const crs = document.getElementById("crs-dropdown").value;
    const format = document.getElementById("format-dropdown").value;
    const width = document.getElementById("number1").value;
    const height = document.getElementById("number2").value;
    const serverInput = document.getElementById("field1");
    const server = serverInput.value ? serverInput.value : serverInput.placeholder;

    let bbox = [
        document.getElementById("number11").value,
        document.getElementById("number111").value,
        document.getElementById("number22").value,
        document.getElementById("number222").value
    ];
    
    if (!layer || !crs || !format || !bbox[0] || !width || !height) {
        alert("Please fill all required fields!");
        return;
    }

    const baseUrl = `${server}/wms?`;
    const commonParams = `service=WMS&version=1.1.1&request=GetMap&layers=${layer}&styles=&bbox=${bbox.join(",")}&width=${width}&height=${height}&crs=${crs}`;

    const requestedFormatUrl = `${baseUrl}${commonParams}&format=${format}`;
    const tiffFormatUrl = `${baseUrl}${commonParams}&format=image/tiff`;
    
    console.log("Fetching WMS:", requestedFormatUrl);
    
    fetchAndDownloadImage(requestedFormatUrl, format);
    fetchAndDisplayTIFF(tiffFormatUrl);
});