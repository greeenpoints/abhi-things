import http.server
import socketserver
import json
import os
import sys
import urllib.request
import urllib.parse
import re
import html

# Reconfigure stdout and stderr to use UTF-8 to prevent console encoding issues
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

PORT = 8080
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECTS_DIR = os.path.join(BASE_DIR, "projects")
PROJECTS_JSON = os.path.join(BASE_DIR, "projects.json")

class CMSHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Override to make sure files are served from the directory containing server.py
        path = super().translate_path(path)
        rel_path = os.path.relpath(path, os.getcwd())
        return os.path.join(BASE_DIR, rel_path)

    def end_headers(self):
        # Prevent browser caching for JSON data files so CMS changes appear immediately
        if self.path.endswith('.json') or '.json?' in self.path:
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

    def do_POST(self):
        if self.path == '/api/save-layout':
            self.handle_save_layout()
        elif self.path == '/api/create-project':
            self.handle_create_project()
        elif self.path == '/api/fetch-product-info':
            self.handle_fetch_product_info()
        elif self.path == '/api/save-products':
            self.handle_save_products()
        else:
            # Fallback for unrecognized POST requests
            self.send_error(404, "Endpoint not found")

    def handle_save_layout(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))

            print(f"\n--- Saving Visual Layout (Received {len(payload)} items) ---")

            # 1. Gather slugs in the order received
            slugs_order = [item['slug'] for item in payload]

            # 2. Update projects.json with the visual ordering
            with open(PROJECTS_JSON, 'w') as f:
                json.dump(slugs_order, f, indent=2)
            print(f"[OK] Overwritten projects.json visually index order.")

            # 3. Update column and position in each project's metadata.json
            updated_count = 0
            for item in payload:
                slug = item['slug']
                col = item['column']
                pos = item['position']
                
                # Check for random string and sanitize
                if col == "random":
                    column_val = "random"
                else:
                    try:
                        column_val = int(col)
                    except ValueError:
                        column_val = 1
                
                try:
                    position_val = int(pos)
                except ValueError:
                    position_val = 1

                meta_path = os.path.join(PROJECTS_DIR, slug, "metadata.json")
                if os.path.exists(meta_path):
                    # Load current metadata
                    with open(meta_path, 'r') as f:
                        meta = json.load(f)
                    
                    # Update parameters
                    meta['column'] = column_val
                    meta['position'] = position_val
                    
                    # Save metadata
                    with open(meta_path, 'w') as f:
                        json.dump(meta, f, indent=2)
                    
                    updated_count += 1
                else:
                    print(f"[WARN] Warning: Metadata not found for slug: {slug}")

            print(f"[OK] Successfully updated {updated_count} individual metadata.json files.")
            print("--------------------------------------------------\n")

            # Send successful response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                "status": "success",
                "message": f"Layout saved! Updated projects.json and {updated_count} metadata files successfully."
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))

        except Exception as e:
            print(f"[ERROR] Error saving layout details: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                "status": "error",
                "message": f"Server failed to write files: {str(e)}"
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))

    def handle_create_project(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))

            title = payload.get('title', 'Untitled').strip()
            slug = payload.get('slug', '').strip()
            category = payload.get('category', 'design').strip()
            column = payload.get('column', 1)
            position = payload.get('position', 1)
            date = payload.get('date', '2025').strip()
            timeline = payload.get('timeline', 'N/A').strip()
            role = payload.get('role', 'Designer').strip()
            collaborators = payload.get('collaborators', 'None').strip()
            description = payload.get('description', '').strip()
            raw_images = payload.get('images', [])

            if not slug:
                raise ValueError("Project slug is required")

            # Clean slug to avoid directory traversal
            slug = os.path.basename(slug.lower().replace(' ', '-').replace('/', '').replace('\\', ''))
            
            project_dir = os.path.join(PROJECTS_DIR, slug)
            os.makedirs(project_dir, exist_ok=True)
            print(f"[OK] Created project directory: {project_dir}")

            # Decode and save image files on server disk
            images_list = []
            for img in raw_images:
                if isinstance(img, dict) and 'name' in img and 'content' in img:
                    img_name = img['name']
                    img_content = img['content']
                    
                    # Extract base64 part
                    if ',' in img_content:
                        header, base64_data = img_content.split(',', 1)
                    else:
                        base64_data = img_content
                    
                    import base64
                    try:
                        file_bytes = base64.b64decode(base64_data)
                        img_path = os.path.join(project_dir, img_name)
                        with open(img_path, 'wb') as img_f:
                            img_f.write(file_bytes)
                        print(f"[OK] Saved dropped image file: {img_path}")
                        images_list.append(img_name)
                    except Exception as img_err:
                        print(f"[ERROR] Failed to decode/save image {img_name}: {img_err}")
                elif isinstance(img, str):
                    images_list.append(img)

            metadata = {
                "title": title,
                "category": category,
                "column": column,
                "position": position,
                "date": date,
                "timeline": timeline,
                "role": role,
                "collaborators": collaborators,
                "description": description,
                "images": images_list
            }

            meta_path = os.path.join(project_dir, "metadata.json")
            with open(meta_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            print(f"[OK] Wrote metadata.json at: {meta_path}")

            # Update projects.json list
            index_list = []
            if os.path.exists(PROJECTS_JSON):
                with open(PROJECTS_JSON, 'r') as f:
                    index_list = json.load(f)
            
            if slug not in index_list:
                index_list.append(slug)
                with open(PROJECTS_JSON, 'w') as f:
                    json.dump(index_list, f, indent=2)
                print(f"[OK] Added slug '{slug}' to projects.json list.")

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                "status": "success",
                "message": "Project created successfully!",
                "projectDir": project_dir,
                "slug": slug
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))

        except Exception as e:
            print(f"[ERROR] Error creating project: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                "status": "error",
                "message": f"Server failed to create project: {str(e)}"
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))

    def slugify_title(self, text):
        text = text.lower()
        # Replace non-alphanumeric chars with hyphens
        text = re.sub(r'[^a-z0-9]+', '-', text)
        return text.strip('-')

    def get_image_extension(self, url, headers=None):
        content_type = headers.get('Content-Type', '') if headers else ''
        if 'image/png' in content_type:
            return '.png'
        if 'image/jpeg' in content_type or 'image/jpg' in content_type:
            return '.jpg'
        if 'image/gif' in content_type:
            return '.gif'
        if 'image/webp' in content_type:
            return '.webp'
        if 'image/svg+xml' in content_type:
            return '.svg'

        parsed = urllib.parse.urlparse(url)
        path = parsed.path
        ext = os.path.splitext(path)[1]
        if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']:
            return ext.lower() if ext.lower() != '.jpeg' else '.jpg'
        return '.jpg'

    def handle_save_products(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))

            print("\n--- Saving Products List (Processing Images) ---")
            
            # Ensure assets/images/products directory exists
            images_dir = os.path.join(BASE_DIR, "assets", "images", "products")
            os.makedirs(images_dir, exist_ok=True)

            processed_payload = []
            for index, p in enumerate(payload):
                title = p.get('title', f"product-{index}").strip()
                image = p.get('image', '').strip()
                slug = self.slugify_title(title)
                if not slug:
                    slug = f"product-{index}"

                if image.startswith("data:image"):
                    print(f"[SAVE] Processing base64 image for: '{title}'")
                    try:
                        header, base64_data = image.split(',', 1)
                        ext = ".png"
                        if "image/jpeg" in header or "image/jpg" in header:
                            ext = ".jpg"
                        elif "image/webp" in header:
                            ext = ".webp"
                        elif "image/gif" in header:
                            ext = ".gif"
                        
                        import base64 as b64
                        import time
                        file_bytes = b64.b64decode(base64_data)
                        
                        filename = f"{slug}_{int(time.time())}{ext}"
                        filepath = os.path.join(images_dir, filename)
                        
                        with open(filepath, 'wb') as img_f:
                            img_f.write(file_bytes)
                        
                        p['image'] = f"assets/images/products/{filename}"
                        print(f"  [OK] Saved base64 to: {p['image']}")
                    except Exception as base64_err:
                        print(f"  [ERROR] Failed to save base64: {base64_err}")
                
                elif image.startswith(("http://", "https://")):
                    print(f"[SAVE] Downloading remote image for: '{title}' ({image})")
                    try:
                        req = urllib.request.Request(
                            image,
                            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
                        )
                        with urllib.request.urlopen(req, timeout=15) as resp:
                            headers = resp.info()
                            file_bytes = resp.read()
                        
                        ext = self.get_image_extension(image, headers)
                        import time
                        filename = f"{slug}_{int(time.time())}{ext}"
                        filepath = os.path.join(images_dir, filename)
                        
                        with open(filepath, 'wb') as img_f:
                            img_f.write(file_bytes)
                        
                        p['image'] = f"assets/images/products/{filename}"
                        print(f"  [OK] Downloaded remote image to: {p['image']}")
                    except Exception as dl_err:
                        print(f"  [ERROR] Failed to download remote image: {dl_err}")
                
                processed_payload.append(p)

            with open(os.path.join(BASE_DIR, "products.json"), 'w', encoding='utf-8') as f:
                json.dump(processed_payload, f, indent=2)
            print("[OK] Overwritten products.json successfully.")
            print("---------------------------------------------\n")

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {
                "status": "success",
                "message": "Products saved successfully!"
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"[ERROR] Error saving products: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                "status": "error",
                "message": f"Server failed to save products: {str(e)}"
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))

    def handle_fetch_product_info(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))

            url = payload.get('url', '').strip()
            print(f"\n--- Fetching Product URL: {url} ---")
            if not url:
                raise ValueError("URL is required")

            req = urllib.request.Request(
                url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                html_content = response.read().decode('utf-8', errors='ignore')

            # 1. Parse Title
            title_match = re.search(r'<title[^>]*>(.*?)</title>', html_content, re.IGNORECASE | re.DOTALL)
            title = title_match.group(1).strip() if title_match else ""
            title = html.unescape(title)

            # Clean Shopify suffix or site name if it's too long
            if "–" in title:
                title = title.split("–")[0].strip()
            elif " - " in title:
                title = title.split(" - ")[0].strip()

            # 2. Extract image links
            images = []
            
            # og:image
            images.extend(re.findall(r'<meta\s+[^>]*property=["\']og:image["\'][^>]*content=["\'](.*?)["\']', html_content, re.IGNORECASE))
            images.extend(re.findall(r'<meta\s+[^>]*content=["\'](.*?)["\'][^>]*property=["\']og:image["\']', html_content, re.IGNORECASE))

            # twitter:image
            images.extend(re.findall(r'<meta\s+[^>]*name=["\']twitter:image["\'][^>]*content=["\'](.*?)["\']', html_content, re.IGNORECASE))
            images.extend(re.findall(r'<meta\s+[^>]*content=["\'](.*?)["\'][^>]*name=["\']twitter:image["\']', html_content, re.IGNORECASE))

            # Favicons
            images.extend(re.findall(r'<link\s+[^>]*rel=["\'](?:shortcut\s+)?icon["\'][^>]*href=["\'](.*?)["\']', html_content, re.IGNORECASE))
            images.extend(re.findall(r'<link\s+[^>]*href=["\'](.*?)["\'][^>]*rel=["\'](?:shortcut\s+)?icon["\']', html_content, re.IGNORECASE))

            # Standard img src
            images.extend(re.findall(r'<img\s+[^>]*src=["\'](.*?)["\']', html_content, re.IGNORECASE))

            # Resolve relative paths and remove duplicates
            resolved_images = []
            seen = set()
            for img_url in images:
                img_url = html.unescape(img_url).strip()
                if not img_url:
                    continue
                # Resolve relative URL to absolute URL
                absolute_url = urllib.parse.urljoin(url, img_url)
                if absolute_url.startswith(('http://', 'https://')):
                    # Exclude typical tracking pixel URLs or tiny buttons if possible
                    if "pixel" not in absolute_url.lower() and "analytics" not in absolute_url.lower():
                        if absolute_url not in seen:
                            seen.add(absolute_url)
                            resolved_images.append(absolute_url)

            # Limit to top 24 images to keep picker lightweight
            resolved_images = resolved_images[:24]

            print(f"[OK] Successfully scraped title: '{title}' and found {len(resolved_images)} images.")
            print("----------------------------------------\n")

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {
                "status": "success",
                "title": title,
                "images": resolved_images
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            print(f"[ERROR] Error scraping URL: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                "status": "error",
                "message": f"Server failed to fetch page data: {str(e)}"
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

print(f"Visual CMS Server running at http://localhost:{PORT}")
print("Press Ctrl+C to stop.")

with ThreadedTCPServer(("", PORT), CMSHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Visual CMS Server...")
        httpd.server_close()
        sys.exit(0)
