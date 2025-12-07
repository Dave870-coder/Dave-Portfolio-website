// Smooth scroll
document.querySelectorAll("a[href^='#']").forEach(link => {
    link.addEventListener("click", e => {
        e.preventDefault();
        document.querySelector(link.getAttribute("href"))
            .scrollIntoView({ behavior: "smooth" });
    });
});

// ✅ Code file upload preview with download functionality
const fileInput = document.getElementById("projectFile");
const fileList = document.getElementById("fileList");
const clearBtn = document.getElementById("clearFiles");
const submitBtn = document.getElementById("submitFiles");
const viewBtn = document.getElementById("viewProjects");
let uploadedFiles = [];
let submittedProjects = [];

// Initialize IndexedDB for large storage capacity (can store 9000+ projects)
let projectDB;

function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("ProjectPortfolio", 2);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            projectDB = request.result;
            resolve(projectDB);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Projects object store
            if (!db.objectStoreNames.contains("projects")) {
                const projectStore = db.createObjectStore("projects", { keyPath: "id", autoIncrement: true });
                projectStore.createIndex("timestamp", "timestamp", { unique: false });
                projectStore.createIndex("name", "name", { unique: false });
            }
            
            // Files object store for storing actual file blobs
            if (!db.objectStoreNames.contains("files")) {
                const fileStore = db.createObjectStore("files", { keyPath: "id", autoIncrement: true });
                fileStore.createIndex("projectId", "projectId", { unique: false });
                fileStore.createIndex("fileName", "fileName", { unique: false });
            }
            
            // Project metadata store
            if (!db.objectStoreNames.contains("metadata")) {
                db.createObjectStore("metadata", { keyPath: "key" });
            }
        };
    });
}

// Save file blob to database
function saveFileBlob(file, projectId) {
    return new Promise(async (resolve, reject) => {
        try {
            await initDatabase();
            const transaction = projectDB.transaction(["files"], "readwrite");
            const store = transaction.objectStore("files");
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileData = {
                    projectId: projectId,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    blob: e.target.result,
                    timestamp: new Date().getTime()
                };
                
                const request = store.add(fileData);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            };
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsArrayBuffer(file);
        } catch (e) {
            console.error("Error saving file blob:", e);
            reject(e);
        }
    });
}

// Load file blob from database
function loadFileBlob(fileId) {
    return new Promise(async (resolve, reject) => {
        try {
            await initDatabase();
            const transaction = projectDB.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const request = store.get(fileId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        } catch (e) {
            console.error("Error loading file blob:", e);
            reject(e);
        }
    });
}

// Load saved projects from IndexedDB on page load
function loadSavedProjects() {
    return new Promise(async (resolve, reject) => {
        try {
            await initDatabase();
            const transaction = projectDB.transaction(["projects"], "readonly");
            const store = transaction.objectStore("projects");
            const request = store.getAll();
            
            request.onsuccess = () => {
                submittedProjects = request.result.map(item => ({
                    id: item.id,
                    name: item.name,
                    type: item.type,
                    size: item.size,
                    description: item.description,
                    timestamp: item.timestamp
                }));
                updateProjectsSection();
                resolve();
            };
            
            request.onerror = () => reject(request.error);
        } catch (e) {
            console.error("Error loading saved projects:", e);
            reject(e);
        }
    });
}

// Save projects to IndexedDB with file blobs
function saveProjects() {
    return new Promise(async (resolve, reject) => {
        try {
            await initDatabase();
            const transaction = projectDB.transaction(["projects"], "readwrite");
            const store = transaction.objectStore("projects");
            
            // Clear existing projects
            store.clear();
            
            // Add new projects with metadata
            for (let i = 0; i < submittedProjects.length; i++) {
                const file = submittedProjects[i];
                const projectId = i + 1;
                
                const projectData = {
                    id: projectId,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    description: file.description || "",
                    timestamp: new Date().getTime(),
                    downloadCount: 0
                };
                
                store.add(projectData);
                
                // Save associated file blob if it's a File object
                if (file instanceof File) {
                    await saveFileBlob(file, projectId);
                }
            }
            
            transaction.oncomplete = () => {
                console.log(`✅ ${submittedProjects.length} projects saved successfully to database!`);
                resolve();
            };
            
            transaction.onerror = () => reject(transaction.error);
        } catch (e) {
            console.error("Error saving projects:", e);
            reject(e);
        }
    });
}

if (fileInput) {
    fileInput.addEventListener("change", () => {
        uploadedFiles = [...fileInput.files];
        displayFiles();
    });
}

if (clearBtn) {
    clearBtn.addEventListener("click", () => {
        uploadedFiles = [];
        fileInput.value = "";
        fileList.innerHTML = "";
        clearBtn.style.display = "none";
        submitBtn.style.display = "none";
        viewBtn.style.display = "none";
        // Remove uploaded project cards from projects section
        document.querySelectorAll(".uploaded-project-card").forEach(card => card.remove());
    });
}

function displayFiles() {
    fileList.innerHTML = "";
    
    if (uploadedFiles.length === 0) {
        clearBtn.style.display = "none";
        submitBtn.style.display = "none";
        viewBtn.style.display = "none";
        return;
    }
    
    clearBtn.style.display = "block";
    submitBtn.style.display = "block";
    viewBtn.style.display = "block";
    
    const listDiv = document.createElement("div");
    listDiv.style.cssText = "margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px;";
    
    const title = document.createElement("p");
    title.textContent = `✅ ${uploadedFiles.length} file(s) selected`;
    title.style.cssText = "margin: 0 0 10px 0; font-weight: 600; color: #4ade80;";
    listDiv.appendChild(title);
    
    uploadedFiles.forEach((file, index) => {
        const fileDiv = document.createElement("div");
        fileDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px; margin: 5px 0; background: rgba(255,255,255,0.08); border-radius: 5px; font-size: 14px;";
        
        const fileInfo = document.createElement("span");
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileInfo.textContent = `📄 ${file.name} (${sizeMB} MB)`;
        fileInfo.style.flex = "1";
        
        const downloadBtn = document.createElement("button");
        downloadBtn.textContent = "⬇️ Download";
        downloadBtn.type = "button";
        downloadBtn.style.cssText = "padding: 5px 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 10px;";
        downloadBtn.addEventListener("click", (e) => {
            e.preventDefault();
            downloadFile(file);
        });
        downloadBtn.addEventListener("mouseover", () => downloadBtn.style.background = "#2563eb");
        downloadBtn.addEventListener("mouseout", () => downloadBtn.style.background = "#3b82f6");
        
        fileDiv.appendChild(fileInfo);
        fileDiv.appendChild(downloadBtn);
        listDiv.appendChild(fileDiv);
    });
    
    fileList.appendChild(listDiv);
    updateUploadPreviewInProjects();
}

function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Update projects section with preview of uploading files (real-time)
function updateUploadPreviewInProjects() {
    const cardContainer = document.querySelector(".card-container");
    if (!cardContainer) return;
    
    // Remove previously added preview cards (but keep submitted ones)
    document.querySelectorAll(".upload-preview-card").forEach(card => card.remove());
    
    // Add preview cards for currently uploading files
    uploadedFiles.forEach((file) => {
        const card = document.createElement("div");
        card.className = "card upload-preview-card";
        card.style.cssText = "cursor: pointer; transition: transform 0.3s ease; border: 2px dashed #60a5fa; opacity: 0.9;";
        
        const fileName = file.name;
        const fileType = file.type || "File";
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        
        card.innerHTML = `
            <h4>⏳ ${fileName}</h4>
            <p>${fileType} • ${sizeMB} MB</p>
            <p style="font-size: 12px; color: #60a5fa; margin: 5px 0 0 0;">Ready to submit</p>
        `;
        
        card.addEventListener("click", () => downloadFile(file));
        card.addEventListener("mouseover", () => card.style.transform = "scale(1.05)");
        card.addEventListener("mouseout", () => card.style.transform = "scale(1)");
        
        cardContainer.appendChild(card);
    });
}

function updateProjectsSection() {
    const cardContainer = document.querySelector(".card-container");
    if (!cardContainer) return;
    
    // Remove previously added uploaded project cards (but keep preview cards)
    document.querySelectorAll(".uploaded-project-card").forEach(card => card.remove());
    
    // Add new cards for submitted files
    submittedProjects.forEach((file) => {
        const card = document.createElement("div");
        card.className = "card uploaded-project-card";
        card.style.cssText = "cursor: pointer; transition: transform 0.3s ease;";
        
        const fileName = file.name;
        const fileType = file.type || "File";
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        
        card.innerHTML = `
            <h4>📤 ${fileName}</h4>
            <p>${fileType} • ${sizeMB} MB</p>
        `;
        
        // Only add download functionality if it's a File object
        if (file instanceof File) {
            card.addEventListener("click", () => downloadFile(file));
        } else {
            card.style.opacity = "0.8";
            card.title = "Click to view saved project info";
        }
        card.addEventListener("mouseover", () => card.style.transform = "scale(1.05)");
        card.addEventListener("mouseout", () => card.style.transform = "scale(1)");
        
        cardContainer.appendChild(card);
    });
}

// Submit Projects Handler
if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
        submittedProjects = [...uploadedFiles];
        await saveProjects();
        // Remove preview cards and add submitted cards
        document.querySelectorAll(".upload-preview-card").forEach(card => card.remove());
        updateProjectsSection();
        alert(`✅ ${submittedProjects.length} project(s) submitted successfully!\n\nYour projects have been saved to the portfolio.`);
        uploadedFiles = [];
        fileInput.value = "";
        fileList.innerHTML = "";
        clearBtn.style.display = "none";
        submitBtn.style.display = "none";
        viewBtn.style.display = "none";
    });
}

// View Projects Handler
if (viewBtn) {
    viewBtn.addEventListener("click", () => {
        const projectsSection = document.getElementById("projects");
        if (projectsSection) {
            projectsSection.scrollIntoView({ behavior: "smooth" });
            // Highlight the uploaded cards
            const uploadedCards = document.querySelectorAll(".uploaded-project-card");
            uploadedCards.forEach(card => {
                card.style.boxShadow = "0 0 20px rgba(74, 222, 128, 0.6)";
                setTimeout(() => {
                    card.style.boxShadow = "";
                }, 3000);
            });
        }
    });
}

// Database Management Functions
const viewDatabaseBtn = document.getElementById("viewDatabase");
const exportDataBtn = document.getElementById("exportData");
const importDataBtn = document.getElementById("importData");
const deleteProjectBtn = document.getElementById("deleteProject");
const clearDatabaseBtn = document.getElementById("clearDatabase");
const importFileInput = document.getElementById("importFile");
const deleteProjectSection = document.getElementById("deleteProjectSection");
const deleteProjectList = document.getElementById("deleteProjectList");
const cancelDeleteBtn = document.getElementById("cancelDelete");

// View database statistics and contents
if (viewDatabaseBtn) {
    viewDatabaseBtn.addEventListener("click", async () => {
        try {
            await initDatabase();
            const databaseInfo = document.getElementById("databaseInfo");
            const projectCountValue = document.getElementById("projectCountValue");
            const fileCountValue = document.getElementById("fileCountValue");
            const projectList = document.getElementById("projectList");
            
            // Get project count
            const transaction = projectDB.transaction(["projects", "files"], "readonly");
            const projectStore = transaction.objectStore("projects");
            const fileStore = transaction.objectStore("files");
            
            projectStore.getAll().onsuccess = (e) => {
                const projects = e.target.result;
                projectCountValue.textContent = projects.length;
                
                projectList.innerHTML = "<strong>Projects in Database:</strong><br>";
                projects.forEach(p => {
                    const projectDiv = document.createElement("div");
                    projectDiv.style.cssText = "padding: 8px; margin: 5px 0; background: rgba(255,255,255,0.08); border-radius: 4px;";
                    projectDiv.innerHTML = `
                        <strong>${p.name}</strong><br>
                        Size: ${(p.size / (1024 * 1024)).toFixed(2)} MB<br>
                        Saved: ${new Date(p.timestamp).toLocaleString()}
                    `;
                    projectList.appendChild(projectDiv);
                });
            };
            
            fileStore.getAll().onsuccess = (e) => {
                fileCountValue.textContent = e.target.result.length;
            };
            
            databaseInfo.style.display = "block";
        } catch (e) {
            alert("❌ Error viewing database: " + e.message);
        }
    });
}

// Export database data as JSON
if (exportDataBtn) {
    exportDataBtn.addEventListener("click", async () => {
        try {
            await initDatabase();
            const transaction = projectDB.transaction(["projects", "files"], "readonly");
            const projectStore = transaction.objectStore("projects");
            const fileStore = transaction.objectStore("files");
            
            const projects = await new Promise(resolve => projectStore.getAll().onsuccess = (e) => resolve(e.target.result));
            const files = await new Promise(resolve => fileStore.getAll().onsuccess = (e) => resolve(e.target.result));
            
            const exportData = {
                version: "1.0",
                exportDate: new Date().toISOString(),
                projects: projects,
                fileMetadata: files.map(f => ({
                    id: f.id,
                    projectId: f.projectId,
                    fileName: f.fileName,
                    fileType: f.fileType,
                    fileSize: f.fileSize,
                    timestamp: f.timestamp
                }))
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `portfolio_backup_${new Date().getTime()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            alert(`✅ Database exported successfully! (${projects.length} projects)`);
        } catch (e) {
            alert("❌ Error exporting database: " + e.message);
        }
    });
}

// Import database data from JSON
if (importDataBtn) {
    importDataBtn.addEventListener("click", () => {
        importFileInput.click();
    });
}

if (importFileInput) {
    importFileInput.addEventListener("change", async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;
            
            const fileContent = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.readAsText(file);
            });
            
            const importedData = JSON.parse(fileContent);
            
            await initDatabase();
            const transaction = projectDB.transaction(["projects"], "readwrite");
            const projectStore = transaction.objectStore("projects");
            projectStore.clear();
            
            importedData.projects.forEach(p => {
                projectStore.add({
                    id: p.id,
                    name: p.name,
                    type: p.type,
                    size: p.size,
                    description: p.description || "",
                    timestamp: p.timestamp,
                    downloadCount: p.downloadCount || 0
                });
            });
            
            transaction.oncomplete = () => {
                submittedProjects = importedData.projects.map(p => ({
                    id: p.id,
                    name: p.name,
                    type: p.type,
                    size: p.size,
                    description: p.description,
                    timestamp: p.timestamp
                }));
                updateProjectsSection();
                alert(`✅ Database imported successfully! (${importedData.projects.length} projects restored)`);
                importFileInput.value = "";
            };
        } catch (e) {
            alert("❌ Error importing database: " + e.message);
        }
    });
}

// Clear entire database
if (clearDatabaseBtn) {
    clearDatabaseBtn.addEventListener("click", async () => {
        if (!confirm("⚠️ Are you sure you want to clear ALL projects and files? This cannot be undone!")) return;
        
        try {
            await initDatabase();
            const transaction = projectDB.transaction(["projects", "files"], "readwrite");
            transaction.objectStore("projects").clear();
            transaction.objectStore("files").clear();
            
            transaction.oncomplete = () => {
                submittedProjects = [];
                uploadedFiles = [];
                document.querySelectorAll(".uploaded-project-card").forEach(card => card.remove());
                document.getElementById("databaseInfo").style.display = "none";
                alert("✅ Database cleared successfully!");
            };
        } catch (e) {
            alert("❌ Error clearing database: " + e.message);
        }
    });
}

// Delete individual project
if (deleteProjectBtn) {
    deleteProjectBtn.addEventListener("click", async () => {
        try {
            await initDatabase();
            const transaction = projectDB.transaction(["projects"], "readonly");
            const projectStore = transaction.objectStore("projects");
            
            projectStore.getAll().onsuccess = (e) => {
                const projects = e.target.result;
                
                if (projects.length === 0) {
                    alert("ℹ️ No projects in database to delete");
                    return;
                }
                
                deleteProjectList.innerHTML = "";
                
                projects.forEach(p => {
                    const projectDiv = document.createElement("div");
                    projectDiv.style.cssText = "padding: 10px; margin: 8px 0; background: rgba(255,255,255,0.08); border-radius: 5px; display: flex; justify-content: space-between; align-items: center;";
                    
                    const projectInfo = document.createElement("span");
                    projectInfo.style.cssText = "flex: 1; font-size: 13px;";
                    projectInfo.innerHTML = `
                        <strong>${p.name}</strong><br>
                        <span style="font-size: 11px; color: #aaa;">Size: ${(p.size / (1024 * 1024)).toFixed(2)} MB • Added: ${new Date(p.timestamp).toLocaleDateString()}</span>
                    `;
                    
                    const deleteBtn = document.createElement("button");
                    deleteBtn.textContent = "🗑️ Delete";
                    deleteBtn.style.cssText = "padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 10px;";
                    
                    deleteBtn.addEventListener("click", () => deleteProjectFromDB(p.id, p.name));
                    deleteBtn.addEventListener("mouseover", () => deleteBtn.style.background = "#dc2626");
                    deleteBtn.addEventListener("mouseout", () => deleteBtn.style.background = "#ef4444");
                    
                    projectDiv.appendChild(projectInfo);
                    projectDiv.appendChild(deleteBtn);
                    deleteProjectList.appendChild(projectDiv);
                });
                
                deleteProjectSection.style.display = "block";
            };
        } catch (e) {
            alert("❌ Error loading projects: " + e.message);
        }
    });
}

// Cancel delete project
if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
        deleteProjectSection.style.display = "none";
        deleteProjectList.innerHTML = "";
    });
}

// Delete specific project from database
async function deleteProjectFromDB(projectId, projectName) {
    if (!confirm(`🗑️ Delete "${projectName}"? This cannot be undone.`)) return;
    
    try {
        await initDatabase();
        const transaction = projectDB.transaction(["projects", "files"], "readwrite");
        const projectStore = transaction.objectStore("projects");
        const fileStore = transaction.objectStore("files");
        
        // Delete the project
        projectStore.delete(projectId);
        
        // Delete associated files
        const fileIndex = fileStore.index("projectId");
        fileIndex.getAllKeys(projectId).onsuccess = (e) => {
            e.target.result.forEach(fileId => fileStore.delete(fileId));
        };
        
        transaction.oncomplete = () => {
            // Reload projects
            submittedProjects = submittedProjects.filter(p => p.id !== projectId);
            document.querySelectorAll(".uploaded-project-card").forEach(card => card.remove());
            updateProjectsSection();
            
            alert(`✅ Project "${projectName}" deleted successfully!`);
            deleteProjectSection.style.display = "none";
            deleteProjectList.innerHTML = "";
        };
    } catch (e) {
        alert("❌ Error deleting project: " + e.message);
    }
}

// Contact Form Handler
const contactForm = document.getElementById("contactForm");

if (contactForm) {
    // Initialize EmailJS with your public key
    emailjs.init({
        publicKey: "pBzjsHfMMvS_K6X0K"
    });
    
    contactForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const name = document.getElementById("contactName").value.trim();
        const email = document.getElementById("contactEmail").value.trim();
        const message = document.getElementById("contactMessage").value.trim();
        
        // Validation
        if (!name || !email || !message) {
            alert("❌ Please fill in all fields");
            return;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert("❌ Please enter a valid email address");
            return;
        }
        
        try {
            // Show sending status
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = "⏳ Sending...";
            submitBtn.disabled = true;
            
            // Send email via EmailJS to your Gmail
            const templateParams = {
                to_email: "oikechukwu312@email.com",
                from_name: name,
                from_email: email,
                message: message,
                reply_to: email
            };
            
            const response = await emailjs.send(
                "service_gmail",
                "template_portfolio_contact",
                templateParams
            );
            
            if (response.status === 200) {
                // Success message
                alert("✅ Message sent successfully! I'll get back to you within 24 hours.");
                contactForm.reset();
                document.getElementById("contactName").focus();
            }
            
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        } catch (error) {
            console.error("Email send error:", error);
            
            // Fallback: Offer alternative contact methods
            alert("⚠️ Message delivery may be delayed, but don't worry!\n\nYou can also:\n1. Email directly: oikechukwu312@email.com\n2. Use the Gmail button to send via your Gmail\n\nYour message: " + message);
            
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            
            // Log error for debugging
            console.log("Full error details:", error.text || error.message || error);
        }
    });
}

// Load saved projects when page loads
loadSavedProjects().catch(err => console.error("Failed to load projects on page load:", err));
