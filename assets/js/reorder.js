// Visual CMS Reorder & Creator Engine for Ashish NR Portfolio
// Handles client-side drag-and-drop grid arrangements and direct project creation

document.addEventListener("DOMContentLoaded", () => {
    let allProjects = [];
    let isChanged = false;

    // DOM Elements
    const col1Bucket = document.getElementById("drag-col-1");
    const col2Bucket = document.getElementById("drag-col-2");
    const col3Bucket = document.getElementById("drag-col-3");
    const col4Bucket = document.getElementById("drag-col-4");
    
    const saveBtn = document.getElementById("save-btn");
    const statusIndicator = document.getElementById("save-status");

    // Form DOM Elements & State
    const form = document.getElementById("cms-form");
    const titleInput = document.getElementById("p-title");
    const slugInput = document.getElementById("p-slug");
    const categorySelect = document.getElementById("p-category");
    const metadataFields = document.getElementById("metadata-fields");
    const feedbackBox = document.getElementById("feedback-box");
    const feedbackMsg = document.getElementById("feedback-message");
    const createBtn = document.getElementById("create-btn");

    // Dropzone Elements & State
    const dropzone = document.getElementById("image-dropzone");
    const fileInput = document.getElementById("p-image-files");
    const filesList = document.getElementById("dropped-files-list");
    let uploadedFiles = []; // State array of objects: { name, base64, fileObject }

    // Click dropzone to trigger hidden file selector
    dropzone.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
        handleSelectedFiles(e.target.files);
        fileInput.value = ""; // Clear input for future selections
    });

    // Drag over styling triggers
    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("drag-over");
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("drag-over");
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("drag-over");
        handleSelectedFiles(e.dataTransfer.files);
    });

    // Process files selected/dropped
    function handleSelectedFiles(files) {
        const imageFiles = [...files].filter(f => f.type.startsWith("image/"));
        
        imageFiles.forEach(file => {
            // Avoid duplicate file names
            if (uploadedFiles.some(existing => existing.name === file.name)) {
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedFiles.push({
                    name: file.name,
                    base64: e.target.result,
                    fileObject: file
                });
                renderDroppedFiles();
            };
            reader.readAsDataURL(file);
        });
    }

    // Render Dropped Files previews
    function renderDroppedFiles() {
        filesList.innerHTML = "";
        
        uploadedFiles.forEach((file, index) => {
            const row = document.createElement("div");
            row.className = "dropped-file-row";
            
            row.innerHTML = `
                <div class="dropped-file-info">
                    <img class="dropped-file-preview" src="${file.base64}" alt="${file.name}">
                    <span class="dropped-file-name" title="${file.name}">${file.name}</span>
                </div>
                <button type="button" class="remove-file-btn" data-index="${index}">&times;</button>
            `;
            
            // Delete button handler
            row.querySelector(".remove-file-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(e.target.getAttribute("data-index"));
                uploadedFiles.splice(idx, 1);
                renderDroppedFiles();
            });
            
            filesList.appendChild(row);
        });
    }

    // Real-time Title Slugifier
    titleInput.addEventListener("input", () => {
        slugInput.value = titleInput.value.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "") // remove special characters
            .replace(/\s+/g, "-")        // replace spaces with hyphens
            .replace(/-+/g, "-")         // replace consecutive hyphens
            .trim();
    });

    // Dynamic Metadata Form Fields Toggle (Hide metadata when Art/Illustration category is selected)
    categorySelect.addEventListener("change", () => {
        if (categorySelect.value === "art") {
            metadataFields.style.display = "none";
        } else {
            metadataFields.style.display = "block";
        }
    });

    // Unified Project Creator Submission
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const title = titleInput.value.trim();
        const slug = slugInput.value.trim();
        const category = categorySelect.value;
        const column = parseInt(document.getElementById("p-column").value);
        const position = parseInt(document.getElementById("p-position").value);
        const desc = document.getElementById("p-description").value.trim();
        
        // Ensure at least one image is uploaded
        if (uploadedFiles.length === 0) {
            feedbackBox.style.display = "block";
            feedbackBox.className = "feedback-box error";
            feedbackMsg.innerHTML = "<strong>Validation Error:</strong> Please drag and drop or select at least one project image.";
            feedbackBox.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        // Map uploadedFiles Base64 content for API payload
        const imagesPayload = uploadedFiles.map(file => ({
            name: file.name,
            content: file.base64
        }));
        
        const date = category === "design" ? (document.getElementById("p-date").value.trim() || "2025") : "2025";
        const timeline = category === "design" ? (document.getElementById("p-timeline").value.trim() || "N/A") : "N/A";
        const role = category === "design" ? (document.getElementById("p-role").value.trim() || "Designer") : "Illustration";
        const collaborators = category === "design" ? (document.getElementById("p-collaborators").value.trim() || "None") : "None";
        
        const newProjectPayload = {
            title,
            slug,
            category,
            column,
            position,
            date,
            timeline,
            role,
            collaborators,
            description: desc || (category === "art" ? "An original digital illustration by Ashish N Remesh." : ""),
            images: imagesPayload
        };
        
        try {
            feedbackBox.style.display = "block";
            feedbackBox.className = "feedback-box";
            feedbackMsg.innerHTML = "Uploading files and creating project directories...";
            
            createBtn.disabled = true;
            createBtn.textContent = "CREATING...";
            
            const result = await API.createProject(newProjectPayload);
            
            createBtn.disabled = false;
            createBtn.textContent = "CREATE & ADD TO GRID";
            
            if (!result || result.status === "error") {
                throw new Error(result.message || "Failed to create project");
            }
            
            // Show success instructions
            feedbackBox.className = "feedback-box success";
            feedbackMsg.innerHTML = `
                <strong>Project created successfully!</strong><br>
                <span style="color:#ffffff;">Directory:</span> <code>projects/${result.slug}/</code><br>
                <span style="color:#ffffff;">Uploaded:</span> <code>${imagesPayload.length} images saved directly on disk.</code><br>
                <span style="color:#ffffff;">Success:</span> Your images are saved and card thumbnail has been added to the grid!
            `;
            
            // Reset form controls & uploadedFiles list state
            form.reset();
            uploadedFiles = [];
            renderDroppedFiles();
            metadataFields.style.display = "block"; // restore defaults
            
            // Auto reload visual workspace so new item appears instantly in visual layout columns!
            await loadWorkspace();
            
        } catch (error) {
            console.error("Error creating project:", error);
            feedbackBox.className = "feedback-box error";
            feedbackMsg.innerHTML = `<strong>Error:</strong> Failed to create project: ${error.message || error}`;
            
            createBtn.disabled = false;
            createBtn.textContent = "CREATE & ADD TO GRID";
        }
    });

    // Retrieve full portfolio database
    async function loadWorkspace() {
        try {
            statusIndicator.textContent = "Loading database...";
            
            const projectSlugs = await API.fetchProjectsList();
            
            const fetchPromises = projectSlugs.map(async (slug) => {
                try {
                    const metadata = await API.fetchProjectMetadata(slug);
                    return { slug, ...metadata };
                } catch (e) {
                    console.error(`Failed to fetch metadata for: ${slug}`, e);
                    return null;
                }
            });
            
            const loaded = await Promise.all(fetchPromises);
            allProjects = loaded.filter(p => p !== null);
            
            renderWorkspace();
            statusIndicator.textContent = "All changes saved";
            statusIndicator.classList.remove("unsaved");
            isChanged = false;
            
        } catch (e) {
            console.error("Error building workspace:", e);
            statusIndicator.textContent = "Failed to load database";
        }
    }

    // Sort and render items inside visual columns
    function renderWorkspace() {
        col1Bucket.innerHTML = "";
        col2Bucket.innerHTML = "";
        col3Bucket.innerHTML = "";
        col4Bucket.innerHTML = "";

        const c1List = [];
        const c2List = [];
        const c3List = [];
        const c4List = [];

        // Distribute into lists based on column
        allProjects.forEach(project => {
            let col = parseInt(project.column);
            if (isNaN(col) || col < 1 || col > 4) {
                col = 1; // Default fallback
            }

            if (col === 1) c1List.push(project);
            else if (col === 2) c2List.push(project);
            else if (col === 3) c3List.push(project);
            else c4List.push(project);
        });

        // Sort each column list by their position property (ascending)
        const sortByPosition = (a, b) => {
            const posA = a.position !== undefined ? parseInt(a.position) : 999;
            const posB = b.position !== undefined ? parseInt(b.position) : 999;
            return posA - posB;
        };

        c1List.sort(sortByPosition);
        c2List.sort(sortByPosition);
        c3List.sort(sortByPosition);
        c4List.sort(sortByPosition);

        // Render card elements
        c1List.forEach(p => renderCard(p, col1Bucket));
        c2List.forEach(p => renderCard(p, col2Bucket));
        c3List.forEach(p => renderCard(p, col3Bucket));
        c4List.forEach(p => renderCard(p, col4Bucket));

        setupDragAndDrop();
    }

    function renderCard(project, bucketElement) {
        const card = document.createElement("div");
        card.className = "drag-card-item";
        card.setAttribute("draggable", "true");
        card.setAttribute("data-slug", project.slug);

        const hasImages = project.images && project.images.length > 0;
        const imagePath = hasImages ? `projects/${project.slug}/${project.images[0]}` : "assets/images/placeholder.jpg";
        
        // Show type tag (ART vs DESIGN) in small letters
        const typeTag = project.category === "art" ? "ART" : "DESIGN";
        
        card.innerHTML = `
            <img class="drag-card-thumb" src="${imagePath}" alt="${project.title}" onerror="this.src='assets/css/reorder.css'; this.className='drag-card-thumb placeholder'; this.outerHTML='<div class=\\'drag-card-thumb\\' style=\\'background:#1a1a1a; display:flex; align-items:center; justify-content:center; font-size:8px; color:#555; text-align:center; flex-shrink:0;\\'>NO IMG</div>';">
            <div class="drag-card-details">
                <div class="drag-card-title">${project.title}</div>
                <div class="drag-card-meta">${typeTag} / COL ${project.column} / POS ${project.position || 0}</div>
            </div>
        `;

        bucketElement.appendChild(card);
    }

    // HTML5 Drag and Drop Handlers
    function setupDragAndDrop() {
        const cards = document.querySelectorAll(".drag-card-item");
        const buckets = document.querySelectorAll(".drag-column-bucket");

        cards.forEach(card => {
            card.addEventListener("dragstart", handleDragStart);
            card.addEventListener("dragend", handleDragEnd);
        });

        buckets.forEach(bucket => {
            bucket.addEventListener("dragover", handleDragOver);
            bucket.addEventListener("dragenter", handleDragEnter);
            bucket.addEventListener("dragleave", handleDragLeave);
            bucket.addEventListener("drop", handleDrop);
        });
    }

    function handleDragStart(e) {
        this.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", this.getAttribute("data-slug"));
    }

    function handleDragEnd() {
        this.classList.remove("dragging");
        updateCardsVisualMetadata();
    }

    function handleDragEnter(e) {
        e.preventDefault();
        this.classList.add("drag-over");
    }

    function handleDragLeave() {
        this.classList.remove("drag-over");
    }

    function handleDragOver(e) {
        e.preventDefault();
        const draggingCard = document.querySelector(".dragging");
        if (!draggingCard) return;

        const afterElement = getDragAfterElement(this, e.clientY);
        if (afterElement == null) {
            this.appendChild(draggingCard);
        } else {
            this.insertBefore(draggingCard, afterElement);
        }
        
        markAsUnchanged(false); // Mark as unsaved
    }

    function handleDrop(e) {
        e.preventDefault();
        this.classList.remove("drag-over");
        updateCardsVisualMetadata();
    }

    // Helper to calculate card below pointer for inserting before
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll(".drag-card-item:not(.dragging)")];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Dynamically update subtitles inside cards to reflect new dragged columns
    function updateCardsVisualMetadata() {
        [col1Bucket, col2Bucket, col3Bucket, col4Bucket].forEach((bucket, index) => {
            const colNum = index + 1;
            const cards = bucket.querySelectorAll(".drag-card-item");
            
            cards.forEach((card, posIndex) => {
                const slug = card.getAttribute("data-slug");
                const project = allProjects.find(p => p.slug === slug);
                const typeTag = project ? (project.category === "art" ? "ART" : "DESIGN") : "ART";
                
                const metaEl = card.querySelector(".drag-card-meta");
                if (metaEl) {
                    metaEl.textContent = `${typeTag} / COL ${colNum} / POS ${posIndex + 1}`;
                }
            });
        });
    }

    function markAsUnchanged(saved) {
        isChanged = !saved;
        if (isChanged) {
            statusIndicator.textContent = "Unsaved Changes*";
            statusIndicator.classList.add("unsaved");
        } else {
            statusIndicator.textContent = "All changes saved";
            statusIndicator.classList.remove("unsaved");
        }
    }

    // Compile state lists, build ranks payload, and post to backend
    async function saveLayout() {
        if (saveBtn.classList.contains("saving")) return;

        saveBtn.classList.add("saving");
        saveBtn.textContent = "SAVING...";

        const payload = [];

        // Scrape Column 1
        const c1Cards = col1Bucket.querySelectorAll(".drag-card-item");
        c1Cards.forEach((card, index) => {
            payload.push({
                slug: card.getAttribute("data-slug"),
                column: 1,
                position: index + 1
            });
        });

        // Scrape Column 2
        const c2Cards = col2Bucket.querySelectorAll(".drag-card-item");
        c2Cards.forEach((card, index) => {
            payload.push({
                slug: card.getAttribute("data-slug"),
                column: 2,
                position: index + 1
            });
        });

        // Scrape Column 3
        const c3Cards = col3Bucket.querySelectorAll(".drag-card-item");
        c3Cards.forEach((card, index) => {
            payload.push({
                slug: card.getAttribute("data-slug"),
                column: 3,
                position: index + 1
            });
        });

        // Scrape Column 4
        const c4Cards = col4Bucket.querySelectorAll(".drag-card-item");
        c4Cards.forEach((card, index) => {
            payload.push({
                slug: card.getAttribute("data-slug"),
                column: 4,
                position: index + 1
            });
        });

        try {
            const data = await API.saveLayout(payload);

            if (!data || data.status === "error") {
                throw new Error(data.message || "Failed to save layout");
            }
            console.log("Save layout success:", data);

            // Trigger visual success indicators
            saveBtn.classList.remove("saving");
            saveBtn.classList.add("success");
            saveBtn.textContent = "SAVED!";
            
            markAsUnchanged(true); // Mark as saved

            setTimeout(() => {
                saveBtn.classList.remove("success");
                saveBtn.textContent = "SAVE LAYOUT";
            }, 2000);

        } catch (e) {
            console.error("Failed to save layout:", e);
            saveBtn.classList.remove("saving");
            saveBtn.textContent = "SAVE ERROR";
            statusIndicator.textContent = `Save failed: ${e.message || e}`;
            
            setTimeout(() => {
                saveBtn.textContent = "SAVE LAYOUT";
            }, 3000);
        }
    }

    saveBtn.addEventListener("click", saveLayout);

    // Initial load
    loadWorkspace();
});
