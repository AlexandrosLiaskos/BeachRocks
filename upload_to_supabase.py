#!/usr/bin/env python3
"""
Beach Rocks Data Upload Script
Uploads beachrock data from shapefile to Supabase
"""

import json
import urllib.request
import urllib.error
import ssl

# Supabase Configuration
SUPABASE_URL = "https://uhzhkmqodkulmcoausud.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoemhrbXFvZGt1bG1jb2F1c3VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3ODc3NSwiZXhwIjoyMDgwODU0Nzc1fQ.C1hnWFKK3QqPx-CO3WeXVXBGzEzWANXWmdbofHWgWFc"

def clean_value(val):
    """Clean and normalize values"""
    if val is None:
        return None
    if isinstance(val, float):
        import math
        if math.isnan(val):
            return None
    val_str = str(val).strip()
    if val_str == '' or val_str.lower() == 'nan' or val_str.lower() == 'none':
        return None
    return val_str

def upload_to_supabase(records):
    """Upload records to Supabase"""
    url = f"{SUPABASE_URL}/rest/v1/beachrocks"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # Upload in batches of 50
    batch_size = 50
    total_uploaded = 0
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        data = json.dumps(batch).encode('utf-8')
        
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        
        try:
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, context=ctx) as response:
                total_uploaded += len(batch)
                print(f"Uploaded {total_uploaded}/{len(records)} records...")
        except urllib.error.HTTPError as e:
            print(f"Error uploading batch: {e.code} - {e.read().decode()}")
            return False
        except Exception as e:
            print(f"Error: {e}")
            return False
    
    print(f"Successfully uploaded {total_uploaded} records!")
    return True

def main():
    try:
        import geopandas as gpd
    except ImportError:
        print("Installing geopandas...")
        import subprocess
        subprocess.check_call(['pip', 'install', 'geopandas', 'pyproj', '-q'])
        import geopandas as gpd
    
    shapefile_path = "/home/projects/Beach Rocks/data/beachrocks_DB.shp"
    print(f"Loading shapefile: {shapefile_path}")
    
    gdf = gpd.read_file(shapefile_path)
    print(f"Loaded {len(gdf)} records")
    
    # Convert to WGS84 if needed
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print(f"Converting from {gdf.crs} to EPSG:4326...")
        gdf = gdf.to_crs(epsg=4326)
    
    records = []
    for idx, row in gdf.iterrows():
        geom = row.geometry
        if geom is None:
            continue
        
        lon, lat = geom.x, geom.y
        
        record = {
            'record_no': clean_value(row.get('No_')),
            'reference': clean_value(row.get('Reference')),
            'site': clean_value(row.get('Site')),
            'area': clean_value(row.get('Area')),
            'country': clean_value(row.get('Country')),
            'ocean_sea': clean_value(row.get('Ocean_Sea')),
            'longitude': lon,
            'latitude': lat,
            'pos_type': clean_value(row.get('Pos_type')),
            'maximum_altitude': clean_value(row.get('Max_Altit')),
            'minimum_altitude': clean_value(row.get('Min_Altit')),
            'no_of_slabs': clean_value(row.get('No_of_Sla')),
            'tidal_range': clean_value(row.get('Tidal_Ran')),
            'dating_method': clean_value(row.get('Dating_met')),
            'dated_sample': clean_value(row.get('Dated_Sam')),
            'estimated_age': clean_value(row.get('Estim_Age')),
            'main_composition': clean_value(row.get('Main_Comp')),
            'cement_type': clean_value(row.get('Cement_typ')),
            'cement_microstructure': clean_value(row.get('Cement_Mic')),
            'formation_process': clean_value(row.get('Form_Proc')),
            'formation_location': clean_value(row.get('Form_Loc')),
            'water_table': clean_value(row.get('Water_Tab')),
            'publication_year': clean_value(row.get('Pub_Year'))
        }
        records.append(record)
    
    print(f"Prepared {len(records)} records for upload")
    upload_to_supabase(records)

if __name__ == "__main__":
    main()
