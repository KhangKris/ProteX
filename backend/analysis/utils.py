import logging
import os
import shutil

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("scientific_engine")

def cleanup_uploads_dir(uploads_dir: str, max_files: int = 100):
    """
    Keep the uploads folder clean by deleting older files if file count exceeds max_files.
    """
    try:
        if not os.path.exists(uploads_dir):
            return
        
        files = [os.path.join(uploads_dir, f) for f in os.listdir(uploads_dir)]
        # Filter files only
        files = [f for f in files if os.path.isfile(f)]
        
        if len(files) > max_files:
            # Sort by modification time (oldest first)
            files.sort(key=os.path.getmtime)
            # Remove oldest
            num_to_remove = len(files) - max_files
            for i in range(num_to_remove):
                os.remove(files[i])
                logger.info(f"Cleaned up old uploaded file: {files[i]}")
    except Exception as e:
        logger.error(f"Error cleaning up uploads directory: {str(e)}")
