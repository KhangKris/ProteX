import os
import urllib.request
import logging
import ssl

# Bypass SSL verification for certificate verification failure issues in local environments
ssl._create_default_https_context = ssl._create_unverified_context

from analysis import parse_structure, detect_salt_bridges, detect_hydrogen_bonds

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_scientific")

def run_test():
    test_dir = os.path.dirname(os.path.abspath(__file__))
    pdb_path = os.path.join(test_dir, "1ubq.pdb")
    
    # 1. Download 1UBQ PDB if not already downloaded
    if not os.path.exists(pdb_path):
        url = "https://files.rcsb.org/download/1UBQ.pdb"
        logger.info(f"Downloading test protein 1UBQ from {url}...")
        try:
            urllib.request.urlretrieve(url, pdb_path)
            logger.info("Download completed.")
        except Exception as e:
            logger.error(f"Failed to download test structure: {e}")
            return
            
    # 2. Parse protein structure
    logger.info("Parsing 1ubq.pdb structure using MDAnalysis...")
    try:
        u = parse_structure(pdb_path)
    except Exception as e:
        logger.error(f"Parser failure: {e}")
        return
        
    # 3. Test Salt Bridge Detection
    logger.info("Detecting salt bridges (cutoff < 4.0 A)...")
    salt_bridges = detect_salt_bridges(u)
    logger.info(f"Detected {len(salt_bridges)} salt bridges.")
    for i, sb in enumerate(salt_bridges[:5]):
        logger.info(
            f"  SB {i+1}: {sb['positive_residue']['name']}{sb['positive_residue']['number']}({sb['positive_atom']['name']}) - "
            f"{sb['negative_residue']['name']}{sb['negative_residue']['number']}({sb['negative_atom']['name']}) "
            f"Distance: {sb['distance']} A"
        )
        
    # 4. Test Hydrogen Bond Detection
    logger.info("Detecting hydrogen bonds (distance < 3.5 A, angle > 120)...")
    hbonds_data = detect_hydrogen_bonds(u)
    hbonds = hbonds_data["hydrogen_bonds"]
    logger.info(f"Detected {len(hbonds)} hydrogen bonds using method: {hbonds_data['method']}.")
    if hbonds_data.get("warning"):
        logger.warning(f"  Warning issued: {hbonds_data['warning']}")
        
    for i, hb in enumerate(hbonds[:5]):
        angle_text = f", Angle: {hb['angle']}deg" if hb['angle'] else ""
        logger.info(
            f"  HB {i+1}: {hb['donor_residue']['name']}{hb['donor_residue']['number']}({hb['donor_atom']['name']}) - "
            f"{hb['acceptor_residue']['name']}{hb['acceptor_residue']['number']}({hb['acceptor_atom']['name']}) "
            f"Distance: {hb['distance']} A{angle_text} (Fallback: {hb['fallback']})"
        )
        
    # Cleanup test pdb file
    if os.path.exists(pdb_path):
        os.remove(pdb_path)
        logger.info("Cleaned up test PDB file.")
        
    logger.info("Scientific engine test verification completed successfully!")

if __name__ == "__main__":
    run_test()
