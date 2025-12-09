#!/usr/bin/env python3
"""
Beach Rocks Data Upload Script
Uploads beachrock shapefile data to Supabase database.
Converts coordinates from EPSG:3857 to EPSG:4326 (WGS84).
"""

import os
import sys
import json
from pathlib import Path

try:
    import geopandas as gpd
    from shapely.geometry import mapping
    from supabase import create_client, Client
except ImportError as e:
    print(f"Missing required package: {e}")
    print("Install with: pip install geopandas supabase shapely pyproj")
    sys.exit(1)

# Configuration - Replace with your Supabase credentials
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'YOUR_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', 'YOUR_SUPABASE_SERVICE_KEY')
SHAPEFILE_PATH = Path(__file__).parent.parent / "Beach Rocks" / "data" / "beachrocks_DB.shp"

def clean_value(val):
    """Clean and convert values for JSON serialization."""
    if val is None or (isinstance(val, float) and (val != val)):  # NaN check
        return None
    if isinstance(val, (int, float)):
        return val if val == val else None  # NaN check
    return str(val).strip() if str(val).strip() else None

def load_shapefile(path: Path) -> gpd.GeoDataFrame:
    """Load shapefile and convert to WGS84."""
    print(f"📂 Loading shapefile: {path}")
    gdf = gpd.read_file(path)
    print(f"   Original CRS: {gdf.crs}")
    print(f"   Records: {len(gdf)}")
    
    # Convert to WGS84 (EPSG:4326)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print("   Converting to EPSG:4326 (WGS84)...")
        gdf = gdf.to_crs(epsg=4326)
    
    return gdf

def prepare_records(gdf: gpd.GeoDataFrame) -> list:
    """Prepare records for Supabase insertion."""
    records = []
    for idx, row in gdf.iterrows():
        geom = row.geometry
        if geom is None:
            continue
        
        # Extract coordinates
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
            'maximum_altitude': clean_value(row.get('Maximum_al')),
            'minimum_altitude': clean_value(row.get('Minimum_al')),
            'no_of_slabs': clean_value(row.get('No_of_slab')),
            'tidal_range': clean_value(row.get('Tidal_Rang')),
            'dating_method': clean_value(row.get('Dating_met')),
            'dated_sample': clean_value(row.get('Dated_samp')),
            'estimated_age': clean_value(row.get('Estim_Age')),
            'main_composition': clean_value(row.get('Main_compo')),
            'cement_type': clean_value(row.get('Cement_typ')),
            'cement_microstructure': clean_value(row.get('Cement_mic')),
            'formation_process': clean_value(row.get('Form_Proc')),
            'formation_location': clean_value(row.get('Form_Loc')),
            'water_table': clean_value(row.get('Water_tabl')),
            'publication_year': clean_value(row.get('Year')),
            'age_for_gis': clean_value(row.get('Age_for_GI')),
            'age_category': clean_value(row.get('Age_Catego')),
            'gis_age': clean_value(row.get('GIS_Age')),
            'gis_category': clean_value(row.get('GIS_Categ'))
        }
        records.append(record)
    
    return records

def create_table_sql():
    """Generate SQL to create the beachrocks table."""
    return """
-- Create beachrocks table
CREATE TABLE IF NOT EXISTS beachrocks (
    id SERIAL PRIMARY KEY,
    record_no FLOAT,
    reference TEXT,
    site TEXT,
    area TEXT,
    country TEXT,
    ocean_sea TEXT,
    longitude FLOAT NOT NULL,
    latitude FLOAT NOT NULL,
    pos_type TEXT,
    maximum_altitude TEXT,
    minimum_altitude TEXT,
    no_of_slabs FLOAT,
    tidal_range FLOAT,
    dating_method TEXT,
    dated_sample TEXT,
    estimated_age TEXT,
    main_composition TEXT,
    cement_type TEXT,
    cement_microstructure TEXT,
    formation_process TEXT,
    formation_location TEXT,
    water_table TEXT,
    publication_year FLOAT,
    age_for_gis TEXT,
    age_category TEXT,
    gis_age FLOAT,
    gis_category FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE beachrocks ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access" ON beachrocks
    FOR SELECT USING (true);

-- Create indexes for common filters
CREATE INDEX IF NOT EXISTS idx_beachrocks_country ON beachrocks(country);
CREATE INDEX IF NOT EXISTS idx_beachrocks_ocean_sea ON beachrocks(ocean_sea);
CREATE INDEX IF NOT EXISTS idx_beachrocks_cement_type ON beachrocks(cement_type);
CREATE INDEX IF NOT EXISTS idx_beachrocks_formation_process ON beachrocks(formation_process);
CREATE INDEX IF NOT EXISTS idx_beachrocks_formation_location ON beachrocks(formation_location);
"""

def upload_to_supabase(records: list):
    """Upload records to Supabase."""
    if SUPABASE_URL == 'YOUR_SUPABASE_URL':
        print("\n⚠️  Supabase credentials not configured!")
        print("   Set environment variables:")
        print("   export SUPABASE_URL='your-project-url'")
        print("   export SUPABASE_SERVICE_KEY='your-service-key'")
        print("\n📋 SQL to create table:")
        print(create_table_sql())
        print(f"\n📊 Prepared {len(records)} records for upload")
        # Save records to JSON for manual upload
        with open('beachrocks_data.json', 'w') as f:
            json.dump(records, f, indent=2)
        print("   Records saved to beachrocks_data.json")
        return
    
    print(f"\n🔌 Connecting to Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print(f"📤 Uploading {len(records)} records...")
    batch_size = 100
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        result = supabase.table('beachrocks').insert(batch).execute()
        print(f"   Uploaded batch {i//batch_size + 1}/{(len(records)-1)//batch_size + 1}")
    
    print("✅ Upload complete!")

def main():
    print("=" * 60)
    print("Beach Rocks Data Upload Script")
    print("=" * 60)
    
    if not SHAPEFILE_PATH.exists():
        print(f"❌ Shapefile not found: {SHAPEFILE_PATH}")
        sys.exit(1)
    
    gdf = load_shapefile(SHAPEFILE_PATH)
    records = prepare_records(gdf)
    print(f"\n✅ Prepared {len(records)} records")
    upload_to_supabase(records)

if __name__ == "__main__":
    main()
