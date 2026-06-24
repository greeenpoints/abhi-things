// Shared Persistence API Client for Abhishek Benny CMS & Reorder Dashboards
const API = {
    // Check if Git integration is configured
    isGitConfigured() {
        const token = localStorage.getItem("gh_token");
        const repo = localStorage.getItem("gh_repo");
        const owner = localStorage.getItem("gh_owner");
        return !!(token && repo && owner);
    },

    getGitConfig() {
        return {
            token: localStorage.getItem("gh_token") || "",
            repo: localStorage.getItem("gh_repo") || "",
            owner: localStorage.getItem("gh_owner") || "",
            branch: localStorage.getItem("gh_branch") || "main"
        };
    },

    saveGitConfig(owner, repo, token, branch = "main") {
        localStorage.setItem("gh_owner", owner.trim());
        localStorage.setItem("gh_repo", repo.trim());
        localStorage.setItem("gh_token", token.trim());
        localStorage.setItem("gh_branch", (branch.trim() || "main"));
    },

    clearGitConfig() {
        localStorage.removeItem("gh_owner");
        localStorage.removeItem("gh_repo");
        localStorage.removeItem("gh_token");
        localStorage.removeItem("gh_branch");
    },

    // ── PRODUCTS OPERATIONS ──

    // Fetch Products List
    async fetchProducts() {
        if (this.isGitConfigured()) {
            return this.fetchFromGit("products.json");
        }
        const response = await fetch("products.json?t=" + Date.now());
        if (!response.ok) throw new Error("Failed to fetch products.json");
        return response.json();
    },

    // Save Products List
    async saveProducts(products) {
        if (this.isGitConfigured()) {
            const processedProducts = [];
            for (let p of products) {
                // If it is a newly pasted/dropped base64 image, upload it to Git first
                if (p.image && p.image.startsWith("data:image")) {
                    console.log(`[Git Sync] Uploading base64 image for product: ${p.title}`);
                    const localPath = await this.uploadImageToGit(p.title, p.image, "assets/images/products");
                    p.image = localPath;
                }
                processedProducts.push(p);
            }
            return this.saveToGit("products.json", processedProducts, "Update products list via CMS");
        }

        const response = await fetch("/api/save-products", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(products)
        });
        if (!response.ok) throw new Error("Failed to save products locally");
        return response.json();
    },

    // ── PROJECTS OPERATIONS ──

    // Fetch Projects list (slugs)
    async fetchProjectsList() {
        if (this.isGitConfigured()) {
            return this.fetchFromGit("projects.json");
        }
        const response = await fetch("projects.json?t=" + Date.now());
        if (!response.ok) throw new Error("Failed to fetch projects.json");
        return response.json();
    },

    // Fetch single project metadata
    async fetchProjectMetadata(slug) {
        if (this.isGitConfigured()) {
            return this.fetchFromGit(`projects/${slug}/metadata.json`);
        }
        const response = await fetch(`projects/${slug}/metadata.json?t=${Date.now()}`);
        if (!response.ok) throw new Error(`Failed to fetch metadata for ${slug}`);
        return response.json();
    },

    // Create New Project (with dropped images)
    async createProject(payload) {
        if (this.isGitConfigured()) {
            const title = payload.title || "Untitled";
            const slug = payload.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const rawImages = payload.images || [];

            console.log(`[Git Sync] Creating project '${title}' with slug '${slug}'`);
            
            // Upload images to projects/{slug}/ folder
            const imagesList = [];
            for (let img of rawImages) {
                if (img && typeof img === 'object' && img.name && img.content) {
                    // Upload base64 image
                    const path = await this.uploadImageToGit(slug + "_" + img.name, img.content, `projects/${slug}`);
                    // Only keep basename in metadata.json
                    const basename = path.split('/').pop();
                    imagesList.push(basename);
                } else if (typeof img === 'string') {
                    imagesList.push(img);
                }
            }

            const metadata = {
                title: payload.title,
                category: payload.category || "design",
                column: payload.column || 1,
                position: payload.position || 1,
                date: payload.date || "2025",
                timeline: payload.timeline || "N/A",
                role: payload.role || "Designer",
                collaborators: payload.collaborators || "None",
                description: payload.description || "",
                images: imagesList
            };

            // 1. Commit metadata.json
            await this.saveToGit(`projects/${slug}/metadata.json`, metadata, `Create metadata.json for project ${title}`);

            // 2. Fetch current projects.json index, insert slug if missing, and commit back
            let projectsIndex = [];
            try {
                projectsIndex = await this.fetchProjectsList();
            } catch (e) {
                console.warn("Could not load projects.json index, starting empty", e);
            }
            
            if (!projectsIndex.includes(slug)) {
                projectsIndex.push(slug);
                await this.saveToGit("projects.json", projectsIndex, `Add project ${title} to index`);
            }

            return {
                status: "success",
                message: "Project committed to GitHub successfully!",
                slug: slug
            };
        }

        const response = await fetch("/api/create-project", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Failed to create project locally");
        return response.json();
    },

    // Save Reordered Layout (slug positions)
    async saveLayout(layoutItems) {
        if (this.isGitConfigured()) {
            console.log(`[Git Sync] Saving visual projects layout (${layoutItems.length} items)`);

            // 1. Get ordered list of slugs
            const slugsOrder = layoutItems.map(item => item.slug);
            
            // 2. Commit updated projects.json
            await this.saveToGit("projects.json", slugsOrder, "Save visual projects layout ordering");

            // 3. For each project, fetch metadata, update coordinates, and save back
            for (let item of layoutItems) {
                try {
                    const slug = item.slug;
                    const col = item.column === "random" ? "random" : parseInt(item.column) || 1;
                    const pos = parseInt(item.position) || 1;

                    const metadata = await this.fetchProjectMetadata(slug);
                    metadata.column = col;
                    metadata.position = pos;

                    await this.saveToGit(`projects/${slug}/metadata.json`, metadata, `Update layout coords for ${slug}`);
                } catch (err) {
                    console.error(`Failed to update metadata on Git for: ${item.slug}`, err);
                }
            }

            return {
                status: "success",
                message: "Layout order committed to GitHub successfully!"
            };
        }

        const response = await fetch("/api/save-layout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(layoutItems)
        });
        if (!response.ok) throw new Error("Failed to save layout locally");
        return response.json();
    },

    // ── WEB SCRAPER ──

    // Scrapes product webpage title and images
    async scrapeProductInfo(url) {
        if (this.isGitConfigured() || !window.location.hostname.includes("localhost")) {
            console.log(`[Web Sync Scraper] Using CORS proxy to fetch: ${url}`);
            
            // Fetch via public CORS proxy
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("CORS proxy failed to fetch page data");
            const data = await response.json();
            const htmlContent = data.contents;

            // Use DOMParser to search elements
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, "text/html");

            // Extract Title
            let title = doc.querySelector("title")?.textContent || "";
            title = title.split("–")[0].split(" - ")[0].trim();

            // Gather Images
            const images = [];
            
            // og:image
            const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute("content");
            if (ogImage) images.push(ogImage);

            // twitter:image
            const twImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute("content");
            if (twImage) images.push(twImage);

            // Favicons
            doc.querySelectorAll('link[rel*="icon"]').forEach(el => {
                const href = el.getAttribute("href");
                if (href) images.push(href);
            });

            // Page images
            doc.querySelectorAll("img").forEach(el => {
                const src = el.getAttribute("src");
                if (src) images.push(src);
            });

            // Resolve all URLs to absolute paths
            const resolvedImages = [];
            const seen = new Set();
            for (let imgUrl of images) {
                imgUrl = imgUrl.trim();
                if (!imgUrl) continue;
                try {
                    const absUrl = new URL(imgUrl, url).href;
                    if (absUrl.startsWith("http://") || absUrl.startsWith("https://")) {
                        if (!absUrl.toLowerCase().includes("pixel") && !absUrl.toLowerCase().includes("analytics")) {
                            if (!seen.has(absUrl)) {
                                seen.add(absUrl);
                                resolvedImages.push(absUrl);
                            }
                        }
                    }
                } catch(e) {}
            }

            return {
                status: "success",
                title: title,
                images: resolvedImages.slice(0, 24)
            };
        }

        // Local Server Scraper Backend
        const response = await fetch("/api/fetch-product-info", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url })
        });
        if (!response.ok) throw new Error("Local scraper service error");
        return response.json();
    },

    // ── GITHUB API PERSISTENCE HELPERS ──

    // Retrieve file from Git repo
    async fetchFromGit(path) {
        const config = this.getGitConfig();
        const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`;
        
        const response = await fetch(url, {
            headers: {
                "Authorization": `token ${config.token}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load ${path} from GitHub (${response.status})`);
        }

        const data = await response.json();
        // Decode base64 UTF-8 content safely
        const decoded = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
        return JSON.parse(decoded);
    },

    // Write file back to Git repo (commits changes)
    async saveToGit(path, content, commitMessage) {
        const config = this.getGitConfig();
        const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;

        // Get current file SHA if exists
        let sha = null;
        try {
            const getResp = await fetch(url + `?ref=${config.branch}`, {
                headers: {
                    "Authorization": `token ${config.token}`,
                    "Accept": "application/vnd.github.v3+json"
                }
            });
            if (getResp.ok) {
                const fileData = await getResp.json();
                sha = fileData.sha;
            }
        } catch (e) {
            console.log(`New file target (no previous SHA found for: ${path})`);
        }

        // Base64 encode JSON payload safely
        const jsonStr = JSON.stringify(content, null, 2);
        const encodedContent = btoa(unescape(encodeURIComponent(jsonStr)));

        const body = {
            message: commitMessage,
            content: encodedContent,
            branch: config.branch
        };
        if (sha) body.sha = sha;

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `token ${config.token}`,
                "Content-Type": "application/json",
                "Accept": "application/vnd.github.v3+json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || `Failed to save ${path} to GitHub`);
        }

        return response.json();
    },

    // Upload base64 image data directly to Git repo
    async uploadImageToGit(title, base64Data, directory) {
        const config = this.getGitConfig();
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        // Split header and raw base64 data
        const parts = base64Data.split(',');
        const header = parts[0];
        const content = parts[1];

        let ext = ".png";
        if (header.includes("image/jpeg") || header.includes("image/jpg")) ext = ".jpg";
        else if (header.includes("image/webp")) ext = ".webp";
        else if (header.includes("image/gif")) ext = ".gif";

        const filename = `${slug}_${Date.now()}${ext}`;
        const path = `${directory}/${filename}`;
        const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;

        const body = {
            message: `Upload image asset for ${title} via CMS`,
            content: content,
            branch: config.branch
        };

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `token ${config.token}`,
                "Content-Type": "application/json",
                "Accept": "application/vnd.github.v3+json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || `Failed to upload image file to GitHub`);
        }

        return path;
    }
};

// Initialize GitHub Settings Drawer UI Controller
document.addEventListener("DOMContentLoaded", () => {
    const ghSyncBtn = document.getElementById("gh-sync-btn");
    const ghDrawer = document.getElementById("gh-drawer");
    const drawerOverlay = document.getElementById("drawer-overlay");
    const closeDrawerBtn = document.getElementById("close-drawer-btn");
    
    const ghOwnerInput = document.getElementById("gh-owner");
    const ghRepoInput = document.getElementById("gh-repo");
    const ghBranchInput = document.getElementById("gh-branch");
    const ghTokenInput = document.getElementById("gh-token");
    
    const testGhBtn = document.getElementById("test-gh-btn");
    const saveGhBtn = document.getElementById("save-gh-btn");
    const clearGhBtn = document.getElementById("clear-gh-btn");
    const ghFeedbackMsg = document.getElementById("gh-feedback-msg");
    const ghFeedbackBox = document.getElementById("gh-feedback");

    if (!ghDrawer) return; // drawer elements are not present on the current page

    function showGhFeedback(msg, type = "success") {
        ghFeedbackMsg.textContent = msg;
        ghFeedbackBox.className = `feedback-box ${type}`;
        ghFeedbackBox.style.display = "block";
    }

    function hideGhFeedback() {
        ghFeedbackBox.style.display = "none";
    }

    // Toggle drawer open
    ghSyncBtn.addEventListener("click", () => {
        // Load settings from localStorage
        const config = API.getGitConfig();
        ghOwnerInput.value = config.owner;
        ghRepoInput.value = config.repo;
        ghBranchInput.value = config.branch;
        ghTokenInput.value = config.token;

        // Toggle clear button display depending on active configuration status
        clearGhBtn.style.display = API.isGitConfigured() ? "block" : "none";
        
        // Update nav status indicator class if git mode is active
        updateSyncStatusUI();

        ghDrawer.classList.add("open");
        drawerOverlay.classList.add("active");
        hideGhFeedback();
    });

    // Toggle drawer close
    function closeDrawer() {
        ghDrawer.classList.remove("open");
        drawerOverlay.classList.remove("active");
    }

    closeDrawerBtn.addEventListener("click", closeDrawer);
    drawerOverlay.addEventListener("click", closeDrawer);

    // Save Settings Button
    saveGhBtn.addEventListener("click", () => {
        const owner = ghOwnerInput.value.trim();
        const repo = ghRepoInput.value.trim();
        const token = ghTokenInput.value.trim();
        const branch = ghBranchInput.value.trim() || "main";

        if (!owner || !repo || !token) {
            showGhFeedback("Please fill out Owner, Repo, and Access Token fields.", "error");
            return;
        }

        API.saveGitConfig(owner, repo, token, branch);
        clearGhBtn.style.display = "block";
        showGhFeedback("GitHub settings saved successfully! Reloading to sync grid...", "success");
        updateSyncStatusUI();

        setTimeout(() => {
            closeDrawer();
            window.location.reload();
        }, 1200);
    });

    // Clear Settings Button
    clearGhBtn.addEventListener("click", () => {
        API.clearGitConfig();
        ghOwnerInput.value = "";
        ghRepoInput.value = "";
        ghBranchInput.value = "main";
        ghTokenInput.value = "";
        clearGhBtn.style.display = "none";
        showGhFeedback("GitHub disconnected! Reloading to use local mode...", "success");
        updateSyncStatusUI();

        setTimeout(() => {
            closeDrawer();
            window.location.reload();
        }, 1200);
    });

    // Test Connection Button
    testGhBtn.addEventListener("click", async () => {
        const owner = ghOwnerInput.value.trim();
        const repo = ghRepoInput.value.trim();
        const token = ghTokenInput.value.trim();
        const branch = ghBranchInput.value.trim() || "main";

        if (!owner || !repo || !token) {
            showGhFeedback("Please fill out Owner, Repo, and Access Token fields first.", "error");
            return;
        }

        showGhFeedback("Testing repository connection...", "info");
        testGhBtn.disabled = true;

        try {
            // Fetch repo status via GitHub API
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: {
                    "Authorization": `token ${token}`,
                    "Accept": "application/vnd.github.v3+json"
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || "Failed to query repository status");
            }

            const repoData = await response.json();
            showGhFeedback(`Connection successful! Repository: '${repoData.full_name}' is verified.`, "success");
        } catch (err) {
            showGhFeedback(`Connection test failed: ${err.message}`, "error");
        } finally {
            testGhBtn.disabled = false;
        }
    });

    function updateSyncStatusUI() {
        const saveStatus = document.getElementById("save-status");
        if (!saveStatus) return;

        if (API.isGitConfigured()) {
            const config = API.getGitConfig();
            ghSyncBtn.textContent = `GIT: ${config.owner}/${config.repo}`;
            ghSyncBtn.style.borderColor = "#2ea44f";
            ghSyncBtn.style.color = "#2ea44f";
        } else {
            ghSyncBtn.textContent = "GITHUB SYNC";
            ghSyncBtn.style.borderColor = "var(--colour-copy)";
            ghSyncBtn.style.color = "var(--colour-copy)";
        }
    }

    // Initial load UI status
    updateSyncStatusUI();
});
