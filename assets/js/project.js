// Dynamic Editorial Project Details Engine for Ashish N Remesh Portfolio

document.addEventListener("DOMContentLoaded", () => {
    // 1. Extract project ID from query parameters (?id=malhara)
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get("id");
    
    if (!projectId) {
        // Redirection fallback to home if no ID is present
        window.location.href = "index.html";
        return;
    }

    const titleEl = document.getElementById("project-title");
    const descEl = document.getElementById("project-description");
    const mediaEl = document.getElementById("project-media-list");

    // Fetch and populate page content
    async function loadProjectDetails() {
        try {
            const response = await fetch(`projects/${projectId}/metadata.json`);
            if (!response.ok) {
                throw new Error("Project metadata not found");
            }
            
            const project = await response.json();
            if (!project) return;

            // Set document title
            document.title = `${project.title} - Abhi-things`;

            // 2. Populate Floating Title (Column 1)
            titleEl.textContent = project.title;

            // 3. Populate Description paragraph (Column 2)
            descEl.textContent = project.description || "No description provided.";

            // 4. Populate Metadata list (Column 4)
            const col3El = document.getElementById("project-meta-col-3");
            const col4El = document.getElementById("project-meta-col-4");

            if (col4El) {
                if (col3El) col3El.innerHTML = ""; // keep Column 3 empty for whitespace
                col4El.innerHTML = "";

                const dateVal = project.date || "N/A";
                const timelineVal = project.timeline || "N/A";
                const roleVal = project.role || "Designer";
                const collaboratorVal = project.collaborators || project.collaborator || "None";

                // Date
                const dateItem = document.createElement("div");
                dateItem.className = "meta-item";
                dateItem.innerHTML = `
                    <span class="meta-label">DATE:</span>
                    <span class="meta-value">${dateVal}</span>
                `;
                col4El.appendChild(dateItem);

                // Timeline
                const timelineItem = document.createElement("div");
                timelineItem.className = "meta-item";
                timelineItem.innerHTML = `
                    <span class="meta-label">TIMELINE:</span>
                    <span class="meta-value">${timelineVal}</span>
                `;
                col4El.appendChild(timelineItem);

                // Role
                const roleItem = document.createElement("div");
                roleItem.className = "meta-item";
                roleItem.innerHTML = `
                    <span class="meta-label">ROLE:</span>
                    <span class="meta-value">${roleVal}</span>
                `;
                col4El.appendChild(roleItem);

                // Collaborator
                const collaboratorItem = document.createElement("div");
                collaboratorItem.className = "meta-item";
                collaboratorItem.innerHTML = `
                    <span class="meta-label">COLABORATOR:</span>
                    <span class="meta-value">${collaboratorVal}</span>
                `;
                col4El.appendChild(collaboratorItem);
            }

            // 5. Stack Project Images vertically below, aligned with Column 2
            mediaEl.innerHTML = "";
            
            if (project.images && project.images.length > 0) {
                // If there are multiple images, display them in order
                project.images.forEach((imgFilename) => {
                    const imgPath = `projects/${projectId}/${imgFilename}`;
                    const mediaItem = document.createElement("img");
                    mediaItem.className = "project-media-item";
                    mediaItem.src = imgPath;
                    mediaItem.alt = `${project.title} detailed media`;
                    mediaItem.loading = "lazy";
                    mediaEl.appendChild(mediaItem);
                });
            } else {
                mediaEl.innerHTML = `<p class="project-media-item" style="color: rgba(255,255,255,0.3); background: none; padding: 20px 0;">No project images uploaded yet.</p>`;
            }

        } catch (e) {
            console.error("Error loading project details:", e);
            // Display error state to user gracefully
            descEl.innerHTML = `<span style="color: #ff4d4d;">Failed to load project details. Please check the project directory and metadata configuration.</span>`;
        }
    }

    loadProjectDetails();
});
