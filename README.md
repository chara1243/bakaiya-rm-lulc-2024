
# Land Use and Land Cover Classification of Bakaiya Rural Municipality (2024)

## 1. Project Overview

This project focuses on Land Use and Land Cover (LULC) classification of Bakaiya Rural Municipality, Nepal, for the year 2024 using Google Earth Engine.

The classification uses Sentinel-2 satellite imagery and the Random Forest machine learning algorithm.

## 2. Study Area

Bakaiya Rural Municipality, Makwanpur District, Bagmati Province, Nepal.

## 3. Data Sources

- Sentinel-2 Surface Reflectance Harmonized
- SRTM Digital Elevation Model
- Training and validation reference samples
- Google Earth Engine

## 4. Methodology

1. Study area boundary preparation
2. Sentinel-2 image collection filtering
3. Cloud and shadow masking
4. Annual median composite generation
5. Spectral indices calculation
6. Terrain variable extraction
7. Training and validation sample preparation
8. Random Forest classification
9. Accuracy assessment
10. LULC area calculation
11. Export of classification results

## 5. LULC Classes

| Code | Class |
|---|---|
| 0 | Water |
| 1 | Forest |
| 2 | Shrub |
| 3 | Agriculture |
| 4 | Built-up |
| 5 | Barren land |

## 6. Classification Algorithm

Random Forest classifier with 300 decision trees.

## 7. Software and Tools

- Google Earth Engine
- JavaScript
- QGIS / ArcGIS (for further map processing)

## 8. Outputs

- Categorical LULC GeoTIFF
- Colourized LULC GeoTIFF
- Class area statistics
- Accuracy assessment tables
- Variable importance table
- Reference sample data

## 9. Author

Bhattarai, c.(2026)

## 10. License

See the LICENSE file for usage conditions.
