// Product Grid Rendering Engine for Abhishek Benny Page
document.addEventListener("DOMContentLoaded", () => {
    let allProducts = [];
    const masonryGrid = document.getElementById("masonry-grid");
    let lastColumnCount = 0;

    // Dynamic Viewport Breakpoint Resolver
    function getDesiredColumns() {
        const width = window.innerWidth;
        if (width >= 1200) return 5; // 5 columns on desktop
        if (width >= 992) return 4;
        if (width >= 768) return 3;
        if (width >= 576) return 2;
        return 1;
    }

    // Main loading routine
    async function loadProducts() {
        try {
            // Fetch list of products via the shared persistence client
            allProducts = await API.fetchProducts();
            
            // Initialize active columns count and render
            lastColumnCount = getDesiredColumns();
            renderGrid();
        } catch (e) {
            console.error("Error loading products:", e);
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

        // Distribute product items across the active N columns
        allProducts.forEach((product, index) => {
            let col = parseInt(product.column);
            if (isNaN(col) || col < 1 || col > 5) {
                col = (index % 5) + 1;
            }
            
            // Map saved 5-column layout into the active responsive column count.
            let targetColIndex = N === 5 ? col - 1 : (index % N);
            
            columnsLists[targetColIndex].push(product);
        });

        // Sort items in each column by saved position on desktop
        const sortByPosition = (a, b) => {
            if (N < 5) {
                return 0; // maintain source order
            }
            const posA = a.position !== undefined ? parseInt(a.position) : 999;
            const posB = b.position !== undefined ? parseInt(b.position) : 999;
            return posA - posB;
        };

        // Render card elements inside each column
        columnsLists.forEach((list, colIdx) => {
            list.sort(sortByPosition);
            list.forEach(product => {
                const card = document.createElement("div");
                card.className = "card-item";
                
                // Apply size class from CMS setting (or legacy auto-detect for old products)
                const size = product.size || "fill";
                if (size !== "fill") {
                    card.classList.add(`size-${size}`);
                } else {
                    // Legacy fallback for products without a saved size
                    const isPadded = product.image.includes('.png') || product.style === 'contain' || product.image.includes('FRONT') || product.title.toLowerCase().includes('watch') || product.title.toLowerCase().includes('blue');
                    if (isPadded) card.classList.add("padded-media");
                }
                
                const ownedDot = product.owned === true || product.owned === "true" ? `<div class="owned-badge" title="Owned"></div>` : '';
                card.innerHTML = `
                    ${ownedDot}
                    <img class="card-media" src="${product.image}" alt="${product.title}" loading="lazy">
                    <div class="card-overlay">
                        <div class="card-title-row">
                            <h3 class="card-title">${product.title}</h3>
                        </div>
                    </div>
                `;
                
                // Clicking redirects to product target link
                card.addEventListener("click", () => {
                    if (product.link) {
                        window.location.href = product.link;
                    }
                });
                
                columnsElements[colIdx].appendChild(card);
            });
        });
    }

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
    loadProducts();
});
