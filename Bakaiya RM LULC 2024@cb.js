// ============================================================
// BAKAIYA RURAL MUNICIPALITY LULC CLASSIFICATION — 2024
// ============================================================

// ============================================================
// 1. BASIC SETTINGS
// ============================================================

var bakaiyarm = ee.FeatureCollection(
  "projects/arctic-plasma-486709-s4/assets/Bakaiya_rm"
);

var AOI = bakaiyarm.geometry();

var startDate = '2024-01-01';
var endDate = '2025-01-01';

var randomSeed = 42;
var trainingFraction = 0.70;
var maximumPixelsPerClass = 300;

var classValues = [0, 1, 2, 3, 4, 5];

var classNames = [
  'Water',
  'Forest',
  'Shrub',
  'Agriculture',
  'Built-up',
  'Barren land'
];

var classPalette = [
  '0000FF', // Water
  '006400', // Forest
  'FFC82D', // Shrub
  'FFFF00', // Agriculture
  'FF00FF', // Built-up
  'A0522D'  // Barren land
];

Map.centerObject(AOI, 11);

Map.setOptions('SATELLITE');


// ============================================================
// 2. STUDY-AREA BOUNDARY
// ============================================================

var boundaryStyle = bakaiyarm.style({
  color: '00FFFF',
  fillColor: '00000000',
  width: 2
});

Map.addLayer(
  boundaryStyle,
  {},
  'BAKAIYA RM boundary',
  true
);


// ============================================================
// 3. SENTINEL-2 CLOUD AND SHADOW MASKING
// ============================================================

var sentinelBands = [
  'B2',
  'B3',
  'B4',
  'B5',
  'B6',
  'B7',
  'B8',
  'B8A',
  'B11',
  'B12'
];

function maskSentinel2(image) {

  var scl = image.select('SCL');

  var validMask = scl.neq(0)
    .and(scl.neq(1))
    .and(scl.neq(3))
    .and(scl.neq(8))
    .and(scl.neq(9))
    .and(scl.neq(10))
    .and(scl.neq(11));

  var scaledReflectance = image
    .select(sentinelBands)
    .multiply(0.0001);

  return scaledReflectance
    .updateMask(validMask)
    .copyProperties(
      image,
      ['system:time_start']
    );
}

// ============================================================
// 4. SENTINEL-2 ANNUAL COMPOSITE
// ============================================================

var sentinelCollection = ee.ImageCollection(
  'COPERNICUS/S2_SR_HARMONIZED'
)
  .filterBounds(AOI)
  .filterDate(startDate, endDate)
  .filter(
    ee.Filter.lt(
      'CLOUDY_PIXEL_PERCENTAGE',
      30
    )
  )
  .map(maskSentinel2);

print(
  'Number of Sentinel-2 images:',
  sentinelCollection.size()
);

var sentinel2 = sentinelCollection
  .median()
  .clip(AOI);

print(
  'Sentinel-2 bands:',
  sentinel2.bandNames()
);


// ============================================================
// 5. SENTINEL-2 VISUALIZATION LAYERS
// ============================================================

Map.addLayer(
  sentinel2,
  {
    bands: ['B4', 'B3', 'B2'],
    min: 0.02,
    max: 0.30,
    gamma: 1.20
  },
  'Natural colour 2024',
  true
);

Map.addLayer(
  sentinel2,
  {
    bands: ['B8', 'B4', 'B3'],
    min: 0.02,
    max: 0.40,
    gamma: 1.10
  },
  'False-colour vegetation',
  false
);

Map.addLayer(
  sentinel2,
  {
    bands: ['B11', 'B8', 'B4'],
    min: 0.02,
    max: 0.40,
    gamma: 1.10
  },
  'Agriculture and moisture',
  false
);

Map.addLayer(
  sentinel2,
  {
    bands: ['B12', 'B11', 'B4'],
    min: 0.02,
    max: 0.40,
    gamma: 1.10
  },
  'Built-up and barren land',
  false
);


// ============================================================
// 6. SPECTRAL INDICES
// ============================================================

// NDVI
var NDVI = sentinel2
  .normalizedDifference(['B8', 'B4'])
  .rename('NDVI');

// NDWI
var NDWI = sentinel2
  .normalizedDifference(['B3', 'B8'])
  .rename('NDWI');

// MNDWI
var MNDWI = sentinel2
  .normalizedDifference(['B3', 'B11'])
  .rename('MNDWI');

// NDBI
var NDBI = sentinel2
  .normalizedDifference(['B11', 'B8'])
  .rename('NDBI');

// BSI
var BSI = sentinel2.expression(
  '((SWIR1 + RED) - (NIR + BLUE)) / ' +
  '((SWIR1 + RED) + (NIR + BLUE))',
  {
    SWIR1: sentinel2.select('B11'),
    RED: sentinel2.select('B4'),
    NIR: sentinel2.select('B8'),
    BLUE: sentinel2.select('B2')
  }
).rename('BSI');

// EVI
var EVI = sentinel2.expression(
  '2.5 * ((NIR - RED) / ' +
  '(NIR + 6 * RED - 7.5 * BLUE + 1))',
  {
    NIR: sentinel2.select('B8'),
    RED: sentinel2.select('B4'),
    BLUE: sentinel2.select('B2')
  }
).rename('EVI');

// Red-edge NDVI
var NDRE = sentinel2
  .normalizedDifference(['B8A', 'B5'])
  .rename('NDRE');


// ============================================================
// 7. TERRAIN VARIABLES
// ============================================================

var elevation = ee.Image('USGS/SRTMGL1_003')
  .select('elevation')
  .clip(AOI)
  .rename('Elevation');

var terrain = ee.Terrain.products(elevation);

var slope = terrain
  .select('slope')
  .rename('Slope');

var aspect = terrain
  .select('aspect');

var aspectRadians = aspect
  .multiply(Math.PI)
  .divide(180);

var northness = aspectRadians
  .cos()
  .rename('Northness');

var eastness = aspectRadians
  .sin()
  .rename('Eastness');



// ============================================================
// 8. CLASSIFICATION PREDICTOR IMAGE
// ============================================================

var classificationInput = sentinel2.addBands([
  NDVI,
  NDWI,
  MNDWI,
  NDBI,
  BSI,
  EVI,
  NDRE,
  elevation,
  slope,
  northness,
  eastness
]);

var predictorBands = [
  'B2',
  'B3',
  'B4',
  'B5',
  'B6',
  'B7',
  'B8',
  'B8A',
  'B11',
  'B12',
  'NDVI',
  'NDWI',
  'MNDWI',
  'NDBI',
  'BSI',
  'EVI',
  'NDRE',
  'Elevation',
  'Slope',
  'Northness',
  'Eastness'
];

classificationInput = classificationInput.select(
  predictorBands
);

print(
  'Predictor bands:',
  classificationInput.bandNames()
);

// ============================================================
// 9. INDEX VISUALIZATION
// ============================================================

Map.addLayer(
  NDVI,
  {
    min: 0,
    max: 0.9,
    palette: [
      '8B4513',
      'FFFF00',
      '90EE90',
      '006400'
    ]
  },
  'NDVI',
  false
);

Map.addLayer(
  MNDWI,
  {
    min: -0.5,
    max: 0.5,
    palette: [
      'A52A2A',
      'FFFFFF',
      '00FFFF',
      '0000FF'
    ]
  },
  'MNDWI',
  false
);

Map.addLayer(
  NDBI,
  {
    min: -0.5,
    max: 0.5,
    palette: [
      '008000',
      'FFFFFF',
      'FFA500',
      'FF0000'
    ]
  },
  'NDBI',
  false
);

Map.addLayer(
  BSI,
  {
    min: -0.5,
    max: 0.5,
    palette: [
      '008000',
      'FFFFFF',
      'FFFF00',
      '8B4513'
    ]
  },
  'BSI',
  false
);


// ============================================================
// 10. STANDARDIZE TRAINING FEATURES
// ============================================================

var waterSamples = Water.map(function(feature) {
  return feature.set({
    Class: 0,
    ClassName: 'Water'
  });
});

var forestSamples = Forest.map(function(feature) {
  return feature.set({
    Class: 1,
    ClassName: 'Forest'
  });
});

var shrubSamples = Shrub.map(function(feature) {
  return feature.set({
    Class: 2,
    ClassName: 'Shrub'
  });
});

var agricultureSamples = Agriculture.map(function(feature) {
  return feature.set({
    Class: 3,
    ClassName: 'Agriculture'
  });
});

var builtupSamples = Builtup.map(function(feature) {
  return feature.set({
    Class: 4,
    ClassName: 'Built-up'
  });
});

var barrenSamples = Barrenland.map(function(feature) {
  return feature.set({
    Class: 5,
    ClassName: 'Barren land'
  });
});

var allSampleFeatures = waterSamples
  .merge(forestSamples)
  .merge(shrubSamples)
  .merge(agricultureSamples)
  .merge(builtupSamples)
  .merge(barrenSamples)
  .filterBounds(AOI);

print(
  'Total sample features:',
  allSampleFeatures.size()
);

print(
  'Sample features by class:',
  allSampleFeatures.aggregate_histogram(
    'ClassName'
  )
);


// ============================================================
// 11. DISPLAY SAMPLE FEATURES
// ============================================================

Map.addLayer(
  waterSamples.style({
    color: '0000FF',
    fillColor: '0000FF66',
    pointSize: 4,
    width: 1
  }),
  {},
  'Samples: Water',
  false
);

Map.addLayer(
  forestSamples.style({
    color: '006400',
    fillColor: '00640066',
    pointSize: 4,
    width: 1
  }),
  {},
  'Samples: Forest',
  false
);

Map.addLayer(
  shrubSamples.style({
    color: 'FFC82D',
    fillColor: 'FFC82D66',
    pointSize: 4,
    width: 1
  }),
  {},
  'Samples: Shrub',
  false
);

Map.addLayer(
  agricultureSamples.style({
    color: 'FFFF00',
    fillColor: 'FFFF0066',
    pointSize: 4,
    width: 1
  }),
  {},
  'Samples: Agriculture',
  false
);

Map.addLayer(
  builtupSamples.style({
    color: 'FF00FF',
    fillColor: 'FF00FF66',
    pointSize: 4,
    width: 1
  }),
  {},
  'Samples: Built-up',
  false
);

Map.addLayer(
  barrenSamples.style({
    color: 'A0522D',
    fillColor: 'A0522D66',
    pointSize: 4,
    width: 1
  }),
  {},
  'Samples: Barren land',
  false
);


// ============================================================
// 12. CLASS-BY-CLASS TRAINING/VALIDATION SPLIT
// ============================================================

function splitClassSamples(
  collection,
  seed
) {

  var randomized = collection.randomColumn(
    'SplitRandom',
    seed
  );

  return {
    training: randomized.filter(
      ee.Filter.lt(
        'SplitRandom',
        trainingFraction
      )
    ),

    validation: randomized.filter(
      ee.Filter.gte(
        'SplitRandom',
        trainingFraction
      )
    )
  };
}

var waterSplit = splitClassSamples(
  waterSamples,
  10
);

var forestSplit = splitClassSamples(
  forestSamples,
  20
);

var shrubSplit = splitClassSamples(
  shrubSamples,
  30
);

var agricultureSplit = splitClassSamples(
  agricultureSamples,
  40
);

var builtupSplit = splitClassSamples(
  builtupSamples,
  50
);

var barrenSplit = splitClassSamples(
  barrenSamples,
  60
);

var trainingFeatures = waterSplit.training
  .merge(forestSplit.training)
  .merge(shrubSplit.training)
  .merge(agricultureSplit.training)
  .merge(builtupSplit.training)
  .merge(barrenSplit.training);

var validationFeatures = waterSplit.validation
  .merge(forestSplit.validation)
  .merge(shrubSplit.validation)
  .merge(agricultureSplit.validation)
  .merge(builtupSplit.validation)
  .merge(barrenSplit.validation);

print(
  'Training features by class:',
  trainingFeatures.aggregate_histogram(
    'ClassName'
  )
);

print(
  'Validation features by class:',
  validationFeatures.aggregate_histogram(
    'ClassName'
  )
);


// ============================================================
// 13. SAMPLE PREDICTOR VALUES
// ============================================================

var rawTrainingData =
  classificationInput.sampleRegions({
    collection: trainingFeatures,
    properties: [
      'Class',
      'ClassName'
    ],
    scale: 10,
    geometries: true,
    tileScale: 4
  })
  .filter(
    ee.Filter.notNull(predictorBands)
  );

var validationData =
  classificationInput.sampleRegions({
    collection: validationFeatures,
    properties: [
      'Class',
      'ClassName'
    ],
    scale: 10,
    geometries: true,
    tileScale: 4
  })
  .filter(
    ee.Filter.notNull(predictorBands)
  );

print(
  'Raw training pixels:',
  rawTrainingData.size()
);

print(
  'Raw training pixels by class:',
  rawTrainingData.aggregate_histogram(
    'ClassName'
  )
);

print(
  'Validation pixels:',
  validationData.size()
);

print(
  'Validation pixels by class:',
  validationData.aggregate_histogram(
    'ClassName'
  )
);


// ============================================================
// 14. BALANCE TRAINING PIXELS
// ============================================================

function selectBalancedClass(
  collection,
  classNumber,
  seed
) {

  return collection
    .filter(
      ee.Filter.eq(
        'Class',
        classNumber
      )
    )
    .randomColumn(
      'BalanceRandom',
      seed
    )
    .sort('BalanceRandom')
    .limit(maximumPixelsPerClass);
}

var balancedWater = selectBalancedClass(
  rawTrainingData,
  0,
  100
);

var balancedForest = selectBalancedClass(
  rawTrainingData,
  1,
  200
);

var balancedShrub = selectBalancedClass(
  rawTrainingData,
  2,
  300
);

var balancedAgriculture = selectBalancedClass(
  rawTrainingData,
  3,
  400
);

var balancedBuiltup = selectBalancedClass(
  rawTrainingData,
  4,
  500
);

var balancedBarren = selectBalancedClass(
  rawTrainingData,
  5,
  600
);

var trainingData = balancedWater
  .merge(balancedForest)
  .merge(balancedShrub)
  .merge(balancedAgriculture)
  .merge(balancedBuiltup)
  .merge(balancedBarren);

print(
  'Balanced training pixels:',
  trainingData.size()
);

print(
  'Balanced training pixels by class:',
  trainingData.aggregate_histogram(
    'ClassName'
  )
);


// ============================================================
// 15. TRAIN REGULARIZED RANDOM FOREST
// ============================================================

var classifier =
  ee.Classifier.smileRandomForest({
    numberOfTrees: 300,
    variablesPerSplit: 5,
    minLeafPopulation: 5,
    bagFraction: 0.65,
    maxNodes: 100,
    seed: randomSeed
  })
  .train({
    features: trainingData,
    classProperty: 'Class',
    inputProperties: predictorBands
  });

print(
  'Random Forest information:',
  classifier.explain()
);


// ============================================================
// 16. CLASSIFY IMAGE
// ============================================================

var classified = classificationInput
  .classify(classifier)
  .rename('LULC')
  .clip(AOI)
  .toUint8();

Map.addLayer(
  classified,
  {
    min: 0,
    max: 5,
    palette: classPalette
  },
  'Bakaiya RM LULC 2024',
  true
);


// ============================================================
// 17. TRAINING ACCURACY
// ============================================================

var trainingMatrix =
  classifier.confusionMatrix();

print(
  'Training confusion matrix:',
  trainingMatrix
);

print(
  'Training overall accuracy:',
  trainingMatrix.accuracy()
);



// ============================================================
// 18. INDEPENDENT VALIDATION
// ============================================================

var validated = validationData.classify(
  classifier
);

var validationMatrix = validated.errorMatrix({
  actual: 'Class',
  predicted: 'classification',
  order: classValues
});

var overallAccuracy =
  validationMatrix.accuracy();

var kappa =
  validationMatrix.kappa();

var producerAccuracy = ee.Array(
  validationMatrix.producersAccuracy()
);

var userAccuracy = ee.Array(
  validationMatrix.consumersAccuracy()
);

print(
  'Validation confusion matrix:',
  validationMatrix
);

print(
  'Validation overall accuracy:',
  overallAccuracy
);

print(
  'Validation kappa:',
  kappa
);

print(
  "Producer's accuracy:",
  producerAccuracy
);

print(
  "User's accuracy:",
  userAccuracy
);


// ============================================================
// 19. CLASS-WISE ACCURACY TABLE
// ============================================================

var accuracyTable = ee.FeatureCollection(
  ee.List.sequence(0, 5).map(function(index) {

    index = ee.Number(index);

    var className = ee.List(
      classNames
    ).get(index);

    var producer = producerAccuracy.get([
      index,
      0
    ]);

    var user = userAccuracy.get([
      0,
      index
    ]);

    return ee.Feature(null, {
      ClassCode: index,
      ClassName: className,
      ProducerAccuracy: producer,
      UserAccuracy: user,
      OverallAccuracy: overallAccuracy,
      Kappa: kappa
    });
  })
);

print(
  'Class-wise validation accuracy:',
  accuracyTable
);


// ============================================================
// 20. VARIABLE IMPORTANCE
// ============================================================

var variableImportance = ee.Dictionary(
  classifier.explain().get('importance')
);

print(
  'Variable importance:',
  variableImportance
);

var importanceTable = ee.FeatureCollection(
  variableImportance.keys().map(function(name) {

    name = ee.String(name);

    return ee.Feature(null, {
      Predictor: name,
      Importance: variableImportance.get(name)
    });
  })
);

print(
  'Variable-importance table:',
  importanceTable
);


// ============================================================
// 21. AREA BY CLASS
// ============================================================

var areaImage = ee.Image.pixelArea()
  .divide(1000000)
  .rename('Area_km2')
  .addBands(classified);

var groupedArea = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({
    groupField: 1,
    groupName: 'ClassCode'
  }),
  geometry: AOI,
  scale: 10,
  maxPixels: 1e13,
  tileScale: 4
});

var areaGroups = ee.List(
  groupedArea.get('groups')
);

var classNameDictionary = ee.Dictionary({
  '0': 'Water',
  '1': 'Forest',
  '2': 'Shrub',
  '3': 'Agriculture',
  '4': 'Built-up',
  '5': 'Barren land'
});

var colourDictionary = ee.Dictionary({
  '0': '#0000FF',
  '1': '#006400',
  '2': '#FFC82D',
  '3': '#FFFF00',
  '4': '#FF00FF',
  '5': '#A0522D'
});

var areaTable = ee.FeatureCollection(
  areaGroups.map(function(item) {

    item = ee.Dictionary(item);

    var code = ee.Number(
      item.get('ClassCode')
    );

    var codeText = code.format();

    return ee.Feature(null, {
      Value: code,
      ClassCode: code,
      ClassName:
        classNameDictionary.get(codeText),
      ColourHex:
        colourDictionary.get(codeText),
      Area_km2: item.get('sum')
    });
  })
);

print(
  'LULC area table:',
  areaTable
);


// ============================================================
// 22. CLASS LEGEND TABLE FOR ARCMAP
// ============================================================

var legendTable = ee.FeatureCollection([
  ee.Feature(null, {
    Value: 0,
    ClassCode: 0,
    ClassName: 'Water',
    ColourHex: '#0000FF',
    Red: 0,
    Green: 0,
    Blue: 255
  }),

  ee.Feature(null, {
    Value: 1,
    ClassCode: 1,
    ClassName: 'Forest',
    ColourHex: '#006400',
    Red: 0,
    Green: 100,
    Blue: 0
  }),

  ee.Feature(null, {
    Value: 2,
    ClassCode: 2,
    ClassName: 'Shrub',
    ColourHex: '#FFC82D',
    Red: 255,
    Green: 200,
    Blue: 45
  }),

  ee.Feature(null, {
    Value: 3,
    ClassCode: 3,
    ClassName: 'Agriculture',
    ColourHex: '#FFFF00',
    Red: 255,
    Green: 255,
    Blue: 0
  }),

  ee.Feature(null, {
    Value: 4,
    ClassCode: 4,
    ClassName: 'Built-up',
    ColourHex: '#FF00FF',
    Red: 255,
    Green: 0,
    Blue: 255
  }),

  ee.Feature(null, {
    Value: 5,
    ClassCode: 5,
    ClassName: 'Barren land',
    ColourHex: '#A0522D',
    Red: 160,
    Green: 82,
    Blue: 45
  })
]);

print(
  'ArcMap class legend:',
  legendTable
);


// ============================================================
// 23. MAP TITLE
// ============================================================

var titlePanel = ui.Panel({
  style: {
    position: 'top-center',
    padding: '8px 15px',
    backgroundColor: 'rgba(255,255,255,0.90)'
  }
});

var titleLabel = ui.Label({
  value:
    'Land Use and Land Cover of Bakaiya Rural Municipality, 2024',

  style: {
    fontWeight: 'bold',
    fontSize: '18px',
    color: '222222',
    margin: '0'
  }
});

var subtitleLabel = ui.Label({
  value:
    'Sentinel-2 and Random Forest Classification',

  style: {
    fontSize: '12px',
    color: '555555',
    margin: '3px 0 0 0'
  }
});

titlePanel.add(titleLabel);
titlePanel.add(subtitleLabel);

Map.add(titlePanel);


// ============================================================
// 24. MAP LEGEND
// ============================================================

var legendPanel = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '10px 14px',
    backgroundColor: 'rgba(255,255,255,0.92)'
  }
});

var legendTitle = ui.Label({
  value: 'LULC Classes',
  style: {
    fontWeight: 'bold',
    fontSize: '15px',
    margin: '0 0 8px 0'
  }
});

legendPanel.add(legendTitle);

function createLegendRow(
  colour,
  code,
  name
) {

  var colourBox = ui.Label({
    style: {
      backgroundColor: '#' + colour,
      padding: '8px',
      margin: '0 8px 5px 0',
      border: '1px solid #555555'
    }
  });

  var description = ui.Label({
    value: code + ' — ' + name,
    style: {
      margin: '2px 0 5px 0',
      fontSize: '13px'
    }
  });

  return ui.Panel({
    widgets: [
      colourBox,
      description
    ],
    layout: ui.Panel.Layout.Flow(
      'horizontal'
    )
  });
}

for (var i = 0; i < classValues.length; i++) {

  legendPanel.add(
    createLegendRow(
      classPalette[i],
      classValues[i],
      classNames[i]
    )
  );
}

Map.add(legendPanel);


// ============================================================
// 25. ACCURACY DISPLAY PANEL
// ============================================================

var accuracyPanel = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '10px 14px',
    width: '260px',
 backgroundColor: 'rgba(255,255,255,0.92)'
  }
});

accuracyPanel.add(
  ui.Label({
    value: 'Validation Accuracy',
    style: {
      fontWeight: 'bold',
      fontSize: '14px',
      margin: '0 0 5px 0'
    }
  })
);

accuracyPanel.add(
  ui.Label(
    'Calculating accuracy...'
  )
);

overallAccuracy.evaluate(function(value) {

  accuracyPanel.widgets().set(
    1,
    ui.Label({
      value:
        'Overall accuracy: ' +
        (value * 100).toFixed(2) +
        '%',

      style: {
        fontSize: '13px',
        margin: '2px 0'
      }
    })
  );
});

kappa.evaluate(function(value) {

  accuracyPanel.add(
    ui.Label({
      value:
        'Kappa coefficient: ' +
        value.toFixed(3),

      style: {
        fontSize: '13px',
        margin: '2px 0'
      }
    })
  );
});

Map.add(accuracyPanel);


// ============================================================
// 26. PREPARE RAW CATEGORICAL RASTER FOR ARCMAP
// ============================================================

/*
Class values inside Bagmati RM:

0 = Water
1 = Forest
2 = Shrub
3 = Agriculture
4 = Built-up
5 = Barren land

255 = NoData/outside valid classification
*/

var classifiedForArcMap = classified
  .unmask(255)
  .rename('LULC_Class')
  .toUint8();


// ============================================================
// 27. PREPARE COLOURIZED RGB IMAGE
// ============================================================

var classifiedRGB = classified.visualize({
  min: 0,
  max: 5,
  palette: classPalette,
  forceRgbOutput: true
});


// ============================================================
// 28. EXPORT RAW CATEGORICAL GEOTIFF
// ============================================================

Export.image.toDrive({
  image: classifiedForArcMap,
  description:
    'Bakaiya_RM_LULC_2024_Categorical',
  folder: 'Bakaiya_RM_LULC_2024',
  fileNamePrefix:
    'Bakaiya_RM_LULC_2024_Categorical',
  region: AOI,
  scale: 10,
  crs: 'EPSG:32645',
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    cloudOptimized: true,
    noData: 255
  }
});


// ============================================================
// 29. EXPORT COLOURIZED GEOTIFF
// ============================================================

Export.image.toDrive({
  image: classifiedRGB,
  description:
    'Bakaiya_RM_LULC_2024_Colourized',
  folder: 'Bakaiya_RM_LULC_2024',
  fileNamePrefix:
    'Bakaiya_RM_LULC_2024_Colourized',
  region: AOI,
  scale: 10,
  crs: 'EPSG:32645',
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    cloudOptimized: true
  }
});


// ============================================================
// 30. EXPORT CLASS LEGEND FOR ARCMAP
// ============================================================

Export.table.toDrive({
  collection: legendTable,
  description:
    'Bakaiya_RM_LULC_2024_Class_Legend',
  folder: 'Konjyosom_RM_LULC_2024',
  fileNamePrefix:
    'Bakaiya_RM_LULC_2024_Class_Legend',
  fileFormat: 'CSV'
});


// ============================================================
// 31. EXPORT CLASS AREA TABLE
// ============================================================

Export.table.toDrive({
  collection: areaTable,
  description:
    'Bakaiya_RM_LULC_2024_Area',
  folder: 'Bakaiya_RM_LULC_2024',
  fileNamePrefix:
    'Bakaiya_RM_LULC_2024_Area',
  fileFormat: 'CSV'
});


// ============================================================
// 32. EXPORT VALIDATION ACCURACY TABLE
// ============================================================

Export.table.toDrive({
  collection: accuracyTable,
  description:
    'Bakaiya_RM_LULC_2024_Accuracy',
  folder: 'Bakaiya_RM_LULC_2024',
  fileNamePrefix:
    'Bakaiya_RM_LULC_2024_Accuracy',
  fileFormat: 'CSV'
});


// ============================================================
// 33. EXPORT VARIABLE IMPORTANCE
// ============================================================

Export.table.toDrive({
  collection: importanceTable,
  description:
    'Bakaiya_RM_LULC_2024_Variable_Importance',
  folder: 'Bakaiya_RM_LULC_2024',
  fileNamePrefix:
    'Bakaiya_RM_LULC_2024_Variable_Importance',
  fileFormat: 'CSV'
});


// ============================================================
// 34. EXPORT ALL REFERENCE FEATURES
// ============================================================

Export.table.toDrive({
  collection: allSampleFeatures,
  description:
    'Bakaiya_RM_LULC_2024_All_Reference_Samples',
  folder: 'Konjyosom_RM_LULC_2024',
  fileNamePrefix:
    'Bakaiya_RM_LULC_2024_All_Reference_Samples',
  fileFormat: 'GeoJSON'
});


// ============================================================
// 35. EXPORT VALIDATION RESULTS
// ============================================================

Export.table.toDrive({
  collection: validated,
  description:
    'Bakaiya_RM_LULC_2024_Validation_Results',
  folder: 'Konjyosom_RM_LULC_2024',
  fileNamePrefix:
    'Bakaiya_RM_LULC_2024_Validation_Results',
  fileFormat: 'GeoJSON'
});
