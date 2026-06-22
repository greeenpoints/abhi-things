// Product CMS Dashboard Engine for Abhishek Benny
document.addEventListener("DOMContentLoaded", () => {
    let allProducts = [];
    let isChanged = false;

    // DOM Elements - Drag Buckets
    const col1Bucket = document.getElementById("drag-col-1");
    const col2Bucket = document.getElementById("drag-col-2");
    const col3Bucket = document.getElementById("drag-col-3");
    const col4Bucket = document.getElementById("drag-col-4");
    const col5Bucket = document.getElementById("drag-col-5");

    // Edit Mode State Tracker
    let editingProductCard = null;
    const cancelEditBtn = document.getElementById("cancel-edit-btn");

    // Size Picker State
    let selectedSize = "fill";
    const sizeBtns = document.querySelectorAll(".size-picker-btn");
    sizeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            sizeBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedSize = btn.getAttribute("data-size");
            // Live-preview on the card being edited
            if (editingProductCard) {
                editingProductCard.classList.remove("size-fill", "size-fit", "size-small", "size-xs", "padded-media");
                editingProductCard.classList.add(`size-${selectedSize}`);
            }
        });
    });

    function setSizeUI(size) {
        selectedSize = size || "fill";
        sizeBtns.forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-size") === selectedSize);
        });
    }

    // Status Elements
    const saveBtn = document.getElementById("save-btn");
    const statusIndicator = document.getElementById("save-status");

    // Scraper Form Elements
    const fetchBtn = document.getElementById("fetch-btn");
    const pUrlInput = document.getElementById("p-url");
    const scrapingLoader = document.getElementById("scraping-loader");
    
    const form = document.getElementById("cms-form");
    const imagePickerGroup = document.getElementById("image-picker-group");
    const imagePickerGrid = document.getElementById("image-picker-grid");
    const pImageUrlInput = document.getElementById("p-image-url");
    const pTitleInput = document.getElementById("p-title");
    const pLinkInput = document.getElementById("p-link");
    const pOwnedInput = document.getElementById("p-owned");
    const createBtn = document.getElementById("create-btn");
    const feedbackBox = document.getElementById("feedback-box");
    const feedbackMsg = document.getElementById("feedback-message");

    // Copy Paste and Preview elements
    const pasteDropZone = document.getElementById("paste-drop-zone");
    const imagePreview = document.getElementById("image-preview");
    const pasteInstruction = pasteDropZone.querySelector(".paste-instruction");

    // Live validation function
    function validateForm() {
        const title = pTitleInput.value.trim();
        const imageUrl = pImageUrlInput.value.trim();
        const link = pLinkInput.value.trim();
        createBtn.disabled = !(title && imageUrl && link);

        if (editingProductCard) {
            createBtn.textContent = "UPDATE PRODUCT";
            cancelEditBtn.style.display = "block";
        } else {
            createBtn.textContent = "ADD TO GRID";
            cancelEditBtn.style.display = "none";
        }
    }

    // Update Image Preview
    function updateImagePreview(url) {
        if (url && url.trim().length > 0) {
            imagePreview.src = url;
            imagePreview.style.display = "block";
            pasteInstruction.style.display = "none";
        } else {
            imagePreview.style.display = "none";
            pasteInstruction.style.display = "block";
        }
    }

    // Attach validation listeners
    pTitleInput.addEventListener("input", validateForm);
    pLinkInput.addEventListener("input", validateForm);
    pImageUrlInput.addEventListener("input", () => {
        updateImagePreview(pImageUrlInput.value.trim());
        validateForm();
    });

    // Cancel edit state handling
    cancelEditBtn.addEventListener("click", () => {
        exitEditMode();
    });

    function exitEditMode() {
        if (editingProductCard) {
            editingProductCard.classList.remove("selected");
        }
        editingProductCard = null;
        form.reset();
        pOwnedInput.checked = false;
        pUrlInput.value = "";
        setSizeUI("fill");
        updateImagePreview("");
        validateForm();
    }

    // Click zone triggers focus on image URL input
    pasteDropZone.addEventListener("click", () => {
        pImageUrlInput.focus();
    });

    // Handle global and input-specific paste events
    window.addEventListener("paste", (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file' && item.type.indexOf('image/') !== -1) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target.result;
                    pImageUrlInput.value = dataUrl;
                    updateImagePreview(dataUrl);
                    validateForm();
                    showFeedback("Image file pasted from clipboard successfully!", "success");
                };
                reader.readAsDataURL(blob);
                e.preventDefault();
                break;
            }
        }
    });

    // Drag-and-drop file upload on paste zone
    pasteDropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        pasteDropZone.classList.add("drag-over");
    });

    pasteDropZone.addEventListener("dragleave", () => {
        pasteDropZone.classList.remove("drag-over");
    });

    pasteDropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        pasteDropZone.classList.remove("drag-over");
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.indexOf('image/') !== -1) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                pImageUrlInput.value = dataUrl;
                updateImagePreview(dataUrl);
                validateForm();
                showFeedback("Image dropped successfully!", "success");
            };
            reader.readAsDataURL(files[0]);
        }
    });

    // Scraper URL fetch call
    fetchBtn.addEventListener("click", async () => {
        const url = pUrlInput.value.trim();
        if (!url) {
            showFeedback("Please enter a valid URL.", "error");
            return;
        }

        try {
            // Auto-fill redirect link with URL (don't clear existing manual data)
            if (!pLinkInput.value.trim()) {
                pLinkInput.value = url;
            }

            // Only reset image picker, not the manually typed fields
            feedbackBox.style.display = "none";
            imagePickerGroup.style.display = "none";
            imagePickerGrid.innerHTML = "";

            // Show loader
            scrapingLoader.style.display = "block";
            fetchBtn.disabled = true;

            const data = await API.scrapeProductInfo(url);

            scrapingLoader.style.display = "none";
            fetchBtn.disabled = false;

            if (!data || data.status === "error") {
                throw new Error(data.message || "Failed to crawl page");
            }
            
            // Populate form — only overwrite title/link if the user hasn't typed anything yet
            if (!pTitleInput.value.trim() && data.title) {
                pTitleInput.value = data.title;
            }
            if (!pLinkInput.value.trim()) {
                pLinkInput.value = url;
            }
            
            // Render images
            if (data.images && data.images.length > 0) {
                imagePickerGroup.style.display = "block";
                data.images.forEach(imgUrl => {
                    const wrapper = document.createElement("div");
                    wrapper.className = "image-thumbnail-wrapper";
                    
                    const img = document.createElement("img");
                    img.className = "image-thumbnail";
                    img.src = imgUrl;
                    img.loading = "lazy";
                    
                    wrapper.appendChild(img);
                    
                    wrapper.addEventListener("click", () => {
                        // Deselect other thumbnails
                        document.querySelectorAll(".image-thumbnail-wrapper").forEach(w => w.classList.remove("selected"));
                        // Select current
                        wrapper.classList.add("selected");
                        pImageUrlInput.value = imgUrl;
                        updateImagePreview(imgUrl);
                        validateForm();
                    });
                    
                    imagePickerGrid.appendChild(wrapper);
                });
                showFeedback("Scraped! Select an image below, or paste your own above.", "success");
            } else {
                showFeedback("No images found. Paste or type an image URL above manually.", "error");
            }
            validateForm();

        } catch (e) {
            console.error("Scraping failed:", e);
            scrapingLoader.style.display = "none";
            fetchBtn.disabled = false;
            // Pre-fill the redirect link with the URL so the user can still manually add the product
            pLinkInput.value = url;
            validateForm();
            showFeedback("Could not auto-scrape this site. Fill in the title and paste an image manually, then click ADD TO GRID.", "error");
        }
    });

    // Add or edit product in grid
    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const title = pTitleInput.value.trim();
        const imageUrl = pImageUrlInput.value.trim();
        const link = pLinkInput.value.trim();

        if (!title || !imageUrl || !link) {
            showFeedback("All fields are required.", "error");
            return;
        }

        // Prevent duplicate products — only block if the exact same URL already exists
        const isDuplicate = allProducts.some(p => {
            // Skip self when editing
            if (editingProductCard) {
                const oldLink = editingProductCard.getAttribute("data-link");
                if (p.link.toLowerCase().trim() === oldLink.toLowerCase().trim()) {
                    return false;
                }
            }
            return p.link.toLowerCase().trim() === link.toLowerCase().trim();
        });
        
        if (isDuplicate) {
            showFeedback("A product with this exact link already exists in the grid.", "error");
            return;
        }

        if (editingProductCard) {
            // Update card metadata attributes
            editingProductCard.setAttribute("data-title", title);
            editingProductCard.setAttribute("data-image", imageUrl);
            editingProductCard.setAttribute("data-link", link);
            editingProductCard.setAttribute("data-size", selectedSize);
            editingProductCard.setAttribute("data-owned", pOwnedInput.checked);

            // Update card preview content
            const imgEl = editingProductCard.querySelector("img");
            if (imgEl) imgEl.src = imageUrl;
            
            const titleEl = editingProductCard.querySelector(".drag-item-title-overlay");
            if (titleEl) titleEl.textContent = title;

            // Live-preview the owned status green dot
            let ownedBadge = editingProductCard.querySelector(".owned-badge");
            if (pOwnedInput.checked) {
                if (!ownedBadge) {
                    ownedBadge = document.createElement("div");
                    ownedBadge.className = "owned-badge";
                    ownedBadge.title = "Owned";
                    editingProductCard.appendChild(ownedBadge);
                }
            } else {
                if (ownedBadge) {
                    ownedBadge.remove();
                }
            }

            // Apply size class
            editingProductCard.classList.remove("padded-media", "size-fill", "size-fit", "size-small", "size-xs");
            editingProductCard.classList.add(`size-${selectedSize}`);

            exitEditMode();
            updateCardsMetadata();
            showFeedback("Product updated! Drag to reorder, then click SAVE PRODUCTS.", "success");
            markAsUnsaved(true);
        } else {
            // Determine initial column (empty round-robin or column 1)
            const counts = [
                col1Bucket.querySelectorAll(".drag-item").length,
                col2Bucket.querySelectorAll(".drag-item").length,
                col3Bucket.querySelectorAll(".drag-item").length,
                col4Bucket.querySelectorAll(".drag-item").length,
                col5Bucket.querySelectorAll(".drag-item").length
            ];
            const minCount = Math.min(...counts);
            const colIndex = counts.indexOf(minCount) + 1;

            const newProduct = {
                title,
                image: imageUrl,
                link,
                size: selectedSize,
                owned: pOwnedInput.checked,
                column: colIndex,
                position: minCount + 1
            };

            allProducts.push(newProduct);
            renderWorkspace();
            
            // Reset form
            form.reset();
            pOwnedInput.checked = false;
            pUrlInput.value = "";
            setSizeUI("fill");
            updateImagePreview("");

            imagePickerGroup.style.display = "none";
            imagePickerGrid.innerHTML = "";
            createBtn.disabled = true;
            
            showFeedback("Product added to visual columns! Drag to reorder, then click SAVE PRODUCTS.", "success");
            markAsUnsaved(true);
        }
    });

    // Load products list from backend
    async function loadWorkspace() {
        try {
            statusIndicator.textContent = "Loading products...";
            
            allProducts = await API.fetchProducts();
            
            // Standardize format (add column/position if missing)
            allProducts.forEach((prod, index) => {
                if (prod.column === undefined) {
                    prod.column = (index % 5) + 1;
                    prod.position = Math.floor(index / 5) + 1;
                }
            });

            renderWorkspace();
            statusIndicator.textContent = "All changes saved";
            statusIndicator.classList.remove("unsaved");
            isChanged = false;
        } catch (e) {
            console.error("Failed to load products list:", e);
            statusIndicator.textContent = "Failed to load database";
        }
    }

    // Render workspace columns
    function renderWorkspace() {
        col1Bucket.innerHTML = "";
        col2Bucket.innerHTML = "";
        col3Bucket.innerHTML = "";
        col4Bucket.innerHTML = "";
        col5Bucket.innerHTML = "";

        const cols = [[], [], [], [], []];

        allProducts.forEach(prod => {
            let col = parseInt(prod.column);
            if (isNaN(col) || col < 1 || col > 5) {
                col = 1;
            }
            cols[col - 1].push(prod);
        });

        // Sort items inside columns by position
        const sortByPosition = (a, b) => {
            const posA = a.position !== undefined ? parseInt(a.position) : 999;
            const posB = b.position !== undefined ? parseInt(b.position) : 999;
            return posA - posB;
        };

        cols.forEach(list => list.sort(sortByPosition));

        // Render card items into columns
        cols.forEach((list, index) => {
            const bucket = [col1Bucket, col2Bucket, col3Bucket, col4Bucket, col5Bucket][index];
            list.forEach(prod => {
                const card = document.createElement("div");
                card.className = "drag-item";
                
                // Apply size class from saved data (or legacy padded-media auto-detect)
                const size = prod.size || "fill";
                if (size !== "fill") {
                    card.classList.add(`size-${size}`);
                } else {
                    // Legacy auto-detection fallback
                    const isPadded = prod.image.includes('.png') || prod.style === 'contain' || prod.image.includes('FRONT') || prod.title.toLowerCase().includes('watch') || prod.title.toLowerCase().includes('blue');
                    if (isPadded) card.classList.add("padded-media");
                }
                
                // Keep product details in data attributes
                card.setAttribute("draggable", "true");
                card.setAttribute("data-title", prod.title);
                card.setAttribute("data-image", prod.image);
                card.setAttribute("data-link", prod.link);
                card.setAttribute("data-size", size);
                card.setAttribute("data-owned", prod.owned === true || prod.owned === "true");

                const ownedDot = prod.owned === true || prod.owned === "true" ? `<div class="owned-badge" title="Owned"></div>` : '';
                card.innerHTML = `
                    ${ownedDot}
                    <button type="button" class="card-delete-btn" aria-label="Delete product">&times;</button>
                    <img src="${prod.image}" alt="${prod.title}">
                    <div class="drag-item-title-overlay">${prod.title}</div>
                `;

                // Select card to edit
                card.addEventListener("click", () => {
                    document.querySelectorAll(".drag-item").forEach(c => c.classList.remove("selected"));
                    editingProductCard = card;
                    card.classList.add("selected");
                    
                    // Populate inputs
                    pImageUrlInput.value = card.getAttribute("data-image");
                    updateImagePreview(pImageUrlInput.value);
                    pTitleInput.value = card.getAttribute("data-title");
                    pLinkInput.value = card.getAttribute("data-link");
                    pOwnedInput.checked = card.getAttribute("data-owned") === "true";
                    // Restore size picker to card's current size
                    setSizeUI(card.getAttribute("data-size") || "fill");
                    
                    validateForm();
                    showFeedback("Editing product: make changes and click 'UPDATE PRODUCT'.", "success");
                });

                // Delete click handler
                card.querySelector(".card-delete-btn").addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (editingProductCard === card) {
                        exitEditMode();
                    }
                    card.remove();
                    updateCardsMetadata();
                    markAsUnsaved(true);
                });

                bucket.appendChild(card);
            });
        });

        setupDragAndDrop();
    }

    // HTML5 Drag and Drop handlers
    function setupDragAndDrop() {
        const cards = document.querySelectorAll(".drag-item");
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

    let dragSrcElement = null;

    function handleDragStart(e) {
        this.style.opacity = "0.4";
        dragSrcElement = this;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", this.innerHTML);
    }

    function handleDragEnd() {
        this.style.opacity = "1";
        document.querySelectorAll(".drag-item").forEach(card => card.style.opacity = "1");
        updateCardsMetadata();
    }

    function handleDragOver(e) {
        e.preventDefault();
        const afterElement = getDragAfterElement(this, e.clientY);
        if (afterElement == null) {
            this.appendChild(dragSrcElement);
        } else {
            this.insertBefore(dragSrcElement, afterElement);
        }
        markAsUnsaved(true);
    }

    function handleDragEnter(e) {
        e.preventDefault();
        this.classList.add("drag-over");
    }

    function handleDragLeave() {
        this.classList.remove("drag-over");
    }

    function handleDrop(e) {
        e.preventDefault();
        this.classList.remove("drag-over");
        updateCardsMetadata();
    }

    // Find card below pointer for inserting before
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll(".drag-item:not(.dragging)")];
        
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

    // Update internal columns and positions after dragging or deleting
    function updateCardsMetadata() {
        const payload = [];
        [col1Bucket, col2Bucket, col3Bucket, col4Bucket, col5Bucket].forEach((bucket, index) => {
            const colIndex = index + 1;
            const cards = bucket.querySelectorAll(".drag-item");
            cards.forEach((card, posIndex) => {
                payload.push({
                    title: card.getAttribute("data-title"),
                    image: card.getAttribute("data-image"),
                    link: card.getAttribute("data-link"),
                    size: card.getAttribute("data-size") || "fill",
                    owned: card.getAttribute("data-owned") === "true",
                    column: colIndex,
                    position: posIndex + 1
                });
            });
        });
        allProducts = payload;
    }

    // Save payload to products.json
    async function saveProducts() {
        if (saveBtn.classList.contains("saving")) return;

        saveBtn.classList.add("saving");
        saveBtn.textContent = "SAVING...";

        updateCardsMetadata();

        try {
            const data = await API.saveProducts(allProducts);

            saveBtn.classList.remove("saving");
            saveBtn.classList.add("success");
            saveBtn.textContent = "SAVED!";
            
            markAsUnsaved(false);

            if (API.isGitConfigured()) {
                await loadWorkspace();
            }

            setTimeout(() => {
                saveBtn.classList.remove("success");
                saveBtn.textContent = "SAVE PRODUCTS";
            }, 2000);

        } catch (e) {
            console.error("Failed to save products:", e);
            saveBtn.classList.remove("saving");
            saveBtn.textContent = "SAVE ERROR";
            statusIndicator.textContent = "Save failed (Server error)";
            
            setTimeout(() => {
                saveBtn.textContent = "SAVE PRODUCTS";
            }, 3000);
        }
    }

    function markAsUnsaved(changed) {
        isChanged = changed;
        if (isChanged) {
            statusIndicator.textContent = "Unsaved Changes*";
            statusIndicator.classList.add("unsaved");
        } else {
            statusIndicator.textContent = "All changes saved";
            statusIndicator.classList.remove("unsaved");
        }
    }

    function showFeedback(msg, type) {
        feedbackBox.style.display = "block";
        feedbackBox.className = `feedback-box ${type}`;
        feedbackMsg.textContent = msg;
    }

    saveBtn.addEventListener("click", saveProducts);

    // Initial Load
    loadWorkspace();
});
