// Main Application Engine for Ashish N Remesh Portfolio

document.addEventListener("DOMContentLoaded", () => {
    let allProjects = [];
    let currentFilter = "all";
    
    // Lightbox state variables
    let activeIllustrations = [];
    let currentLightboxIdx = -1;
    
    const masonryGrid = document.getElementById("masonry-grid");
    

    
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightbox-img");
    const lightboxCaption = document.getElementById("lightbox-caption");
    const lightboxClose = document.getElementById("lightbox-close");
    const lightboxPrev = document.getElementById("lightbox-prev");
    const lightboxNext = document.getElementById("lightbox-next");

    let lastColumnCount = 0;

    // Dynamic Viewport Breakpoint Resolver
    function getDesiredColumns() {
        const width = window.innerWidth;
        if (width >= 992) return 4; // lg, xl, xxl
        if (width >= 768) return 3; // md
        if (width >= 576) return 2; // sm
        return 1;
    }

    // Stable hash function for "random" column allocation to maintain visual layout stability across 4 columns
    function getStableColumn(slug) {
        let hash = 0;
        for (let i = 0; i < slug.length; i++) {
            hash = slug.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash % 4) + 1; // Returns 1, 2, 3, or 4
    }

    // Main loading routine
    async function loadPortfolio() {
        try {
            // Fetch index list of folders
            const response = await fetch("projects.json");
            const projectSlugs = await response.json();
            
            // Load metadata for each project in parallel
            const fetchPromises = projectSlugs.map(async (slug) => {
                try {
                    const metaResponse = await fetch(`projects/${slug}/metadata.json`);
                    const metadata = await metaResponse.json();
                    return { slug, ...metadata };
                } catch (e) {
                    console.error(`Failed to load metadata for: ${slug}`, e);
                    return null;
                }
            });
            
            const loaded = await Promise.all(fetchPromises);
            allProjects = loaded.filter(p => p !== null);
            
            // Assign global order index from projects.json sequence
            allProjects.forEach(project => {
                project.globalIndex = projectSlugs.indexOf(project.slug);
            });
            
            // Initialize active columns count and render
            lastColumnCount = getDesiredColumns();
            renderGrid();
            
        } catch (e) {
            console.error("Error loading portfolio projects index:", e);
        }
    }

    // Grid rendering engine with dynamic column distribution
    function renderGrid() {
        const N = getDesiredColumns();
        
        // Empty container
        masonryGrid.innerHTML = "";
        
        // Dynamically create N column elements
        const columnsElements = [];
        const columnsLists = [];
        for (let i = 1; i <= N; i++) {
            const colDiv = document.createElement("div");
            colDiv.className = "masonry-column";
            colDiv.id = `col-${i}`;
            masonryGrid.appendChild(colDiv);
            
            columnsElements.push(colDiv);
            columnsLists.push([]);
        }
        
        // Filter projects
        const filteredProjects = allProjects.filter(project => {
            if (currentFilter === "all") return true;
            return project.category === currentFilter;
        });

        // Distribute items across the active N columns
        filteredProjects.forEach(project => {
            let col = parseInt(project.column);
            
            // If random or auto-allocated
            if (isNaN(col) || col < 1 || col > 4 || project.column === "random") {
                col = getStableColumn(project.slug);
            }
            
            // Map saved 4-column layout into the active responsive column count.
            let targetColIndex = N === 4 ? col - 1 : (project.globalIndex % N);
            
            columnsLists[targetColIndex].push(project);
        });

        // Sort items in each column by saved position on desktop, and by source order on collapsed layouts.
        const sortByPosition = (a, b) => {
            if (N < 4) {
                return a.globalIndex - b.globalIndex;
            }
            const posA = a.position !== undefined ? parseInt(a.position) : 999;
            const posB = b.position !== undefined ? parseInt(b.position) : 999;
            return posA - posB;
        };

        // Render card elements inside each column
        columnsLists.forEach((list, index) => {
            list.sort(sortByPosition);
            renderColumn(list, columnsElements[index]);
        });
        
        // Update illustrations queue for lightbox cycling in the global display order
        activeIllustrations = filteredProjects.filter(p => p.category === "art");
        activeIllustrations.sort((a, b) => a.globalIndex - b.globalIndex);
    }

    function renderColumn(projectsList, columnElement) {
        projectsList.forEach(project => {
            const card = document.createElement("div");
            card.className = "card-item";
            
            // Check if there are images
            const hasImages = project.images && project.images.length > 0;
            const imageFilename = hasImages ? project.images[0] : "";
            const imagePath = imageFilename ? `projects/${project.slug}/${imageFilename}` : "assets/images/placeholder.jpg";
            
            const isDesign = project.category === "design";
            const glyphFilename = isDesign ? "glyph2.svg" : "glyph3.svg";
            
            // Construct inner structure with dimming hover overlay, category glyph and title in a row
            card.innerHTML = `
                <img class="card-media" src="${imagePath}" alt="${project.title}" loading="lazy">
                <div class="card-overlay">
                    <div class="card-title-row">
                        <h3 class="card-title">${project.title}</h3>
                        <img class="card-hover-glyph" src="assets/${glyphFilename}" alt="${project.category} symbol">
                    </div>
                </div>
            `;
            
            // Setup click events
            card.addEventListener("click", () => {
                if (project.category === "design") {
                    // Navigate to editorial detail page
                    window.location.href = `project.html?id=${project.slug}`;
                } else if (project.category === "art") {
                    // Open optimized Lightbox carousel
                    openLightbox(project.slug);
                }
            });
            
            columnElement.appendChild(card);
        });
    }

    // Lightbox Carousel Logic
    function openLightbox(slug) {
        const idx = activeIllustrations.findIndex(item => item.slug === slug);
        if (idx === -1) return;
        
        currentLightboxIdx = idx;
        updateLightboxContent();
        
        lightbox.style.display = "flex";
        // Force reflow
        lightbox.offsetHeight;
        lightbox.classList.add("active");
        document.body.style.overflow = "hidden"; // Prevent background scroll
    }

    function closeLightbox() {
        lightbox.classList.remove("active");
        document.body.style.overflow = "";
        setTimeout(() => {
            lightbox.style.display = "none";
        }, 300); // Wait for transition
    }

    function updateLightboxContent() {
        if (currentLightboxIdx < 0 || currentLightboxIdx >= activeIllustrations.length) return;
        
        const project = activeIllustrations[currentLightboxIdx];
        const imagePath = `projects/${project.slug}/${project.images[0]}`;
        
        // Smoothly fade image
        lightboxImg.style.opacity = 0;
        
        const tempImg = new Image();
        tempImg.onload = () => {
            lightboxImg.src = imagePath;
            lightboxImg.style.opacity = 1;
            lightboxCaption.textContent = project.title;
        };
        tempImg.src = imagePath;
    }

    function navigateLightbox(dir) {
        if (activeIllustrations.length === 0) return;
        
        currentLightboxIdx += dir;
        if (currentLightboxIdx >= activeIllustrations.length) {
            currentLightboxIdx = 0; // Wrap around to start
        } else if (currentLightboxIdx < 0) {
            currentLightboxIdx = activeIllustrations.length - 1; // Wrap around to end
        }
        
        updateLightboxContent();
    }



    // Lightbox Event Listeners
    if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
    if (lightboxPrev) lightboxPrev.addEventListener("click", () => navigateLightbox(-1));
    if (lightboxNext) lightboxNext.addEventListener("click", () => navigateLightbox(1));
    
    // Close on clicking overlay background
    if (lightbox) {
        lightbox.addEventListener("click", (e) => {
            if (e.target === lightbox || e.target === lightbox.querySelector(".lightbox-content")) {
                closeLightbox();
            }
        });
    }

    // Keyboard navigation (arrows + ESC)
    document.addEventListener("keydown", (e) => {
        if (!lightbox.classList.contains("active")) return;
        
        if (e.key === "Escape") {
            closeLightbox();
        } else if (e.key === "ArrowLeft") {
            navigateLightbox(-1);
        } else if (e.key === "ArrowRight") {
            navigateLightbox(1);
        }
    });

    // Dynamic resize hook
    function checkAndResizeGrid() {
        const cols = getDesiredColumns();
        if (cols !== lastColumnCount) {
            lastColumnCount = cols;
            renderGrid();
        }
    }

    window.addEventListener("resize", () => {
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(checkAndResizeGrid, 150);
    });

    // Start execution
    loadPortfolio();
});
