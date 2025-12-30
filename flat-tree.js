// Data-driven family tree layout engine
// Calculates positions and renders from family_tree.json

const LAYOUT = {
  personWidth: 58,
  personHeight: 78,
  coupleGap: -6,     // Negative = partners overlap/touch
  siblingGap: 8,     // Gap between siblings
  familyGap: 35,     // Gap between family units
  generationGap: 90, // Vertical gap between generations
  padding: 15
};

class FamilyTreeLayout {
  constructor(data) {
    this.people = new Map();
    this.families = data.families;
    this.hidden = new Set(data.hidden || []);
    this.positions = new Map();
    this.connections = [];

    // Index people by ID
    data.people.forEach(p => {
      if (!this.hidden.has(p.id)) {
        this.people.set(p.id, p);
      }
    });

    // Build relationships
    this.buildRelationships();
  }

  buildRelationships() {
    // Find each person's family (as child) and family (as parent)
    this.childOf = new Map();  // personId -> family where they're a child
    this.parentIn = new Map(); // personId -> families where they're a partner

    this.families.forEach((fam, idx) => {
      fam.children.forEach(childId => {
        if (!this.hidden.has(childId)) {
          this.childOf.set(childId, fam);
        }
      });
      fam.partners.forEach(partnerId => {
        if (!this.hidden.has(partnerId)) {
          if (!this.parentIn.has(partnerId)) {
            this.parentIn.set(partnerId, []);
          }
          this.parentIn.get(partnerId).push(fam);
        }
      });
    });
  }

  // Calculate generation level for each person (0 = oldest)
  calculateGenerations() {
    this.generations = new Map();

    // Find root people (no parents in data)
    const roots = [];
    this.people.forEach((person, id) => {
      if (!this.childOf.has(id)) {
        roots.push(id);
      }
    });

    // BFS to assign generations
    const queue = roots.map(id => ({ id, gen: 0 }));
    const visited = new Set();

    while (queue.length > 0) {
      const { id, gen } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);

      this.generations.set(id, gen);

      // Find children
      const families = this.parentIn.get(id) || [];
      families.forEach(fam => {
        fam.children.forEach(childId => {
          if (!visited.has(childId) && this.people.has(childId)) {
            queue.push({ id: childId, gen: gen + 1 });
          }
        });
      });
    }

    // Handle any unvisited (disconnected) people
    this.people.forEach((person, id) => {
      if (!this.generations.has(id)) {
        this.generations.set(id, 0);
      }
    });
  }

  // Group people by generation
  groupByGeneration() {
    this.genGroups = new Map();
    this.generations.forEach((gen, id) => {
      if (!this.genGroups.has(gen)) {
        this.genGroups.set(gen, []);
      }
      this.genGroups.get(gen).push(id);
    });
  }

  // Main layout calculation - positions children centered under parents
  calculateLayout() {
    this.calculateGenerations();
    this.groupByGeneration();

    // Build family tree with parent-child relationships
    const familyUnits = this.buildFamilyUnits();

    // Calculate widths bottom-up, then position top-down
    this.calculateWidths(familyUnits);
    this.positionUnits(familyUnits);

    this.buildConnections();
  }

  // Build family units with their children
  buildFamilyUnits() {
    return {
      // Row 0: Great-grandparents (roots)
      roots: [
        {
          id: 'ham-popo',
          partners: ['X2', 'X1'],
          childUnits: [
            { id: 'yan-fun', partners: ['F7', 'M11'], childUnits: [], isNephew: true }
          ]
        },
        {
          id: 'peter-cora',
          partners: ['M7', 'M8'],
          childUnits: [
            { id: 'hong', single: 'M1', childUnits: [] },
            { id: 'michelle', single: 'M9', childUnits: [] }
          ]
        },
        {
          id: 'siukee',
          partners: ['X6'],
          childUnits: [
            { id: 'rex', single: 'M2', childUnits: [] }
          ]
        },
        {
          id: 'yehyeh-mama',
          partners: ['X4', 'X5'],
          childUnits: [
            {
              id: 'unclema-auntma',
              partners: ['F3', 'F2'],
              childUnits: [
                {
                  id: 'adrien-ada',
                  partners: ['M3', 'M4'],
                  childUnits: [
                    { id: 'siah', single: 'B3', childUnits: [] }
                  ]
                }
              ]
            },
            {
              id: 'ernest-amy',
              partners: ['F5', 'F6'],
              childUnits: [
                { id: 'stanley-angela', partners: ['B1', 'B2'], childUnits: [] },
                {
                  id: 'wilfred-mary',
                  partners: ['B12', 'B11'],
                  childUnits: [
                    { id: 'zachary', single: 'B6', childUnits: [] },
                    { id: 'xavier', single: 'B8', childUnits: [] },
                    { id: 'sebastian', single: 'B4', childUnits: [] }
                  ]
                },
                {
                  id: 'stewart-mae',
                  partners: ['B10', 'B9'],
                  childUnits: [
                    { id: 'kayley', single: 'B5', childUnits: [] },
                    { id: 'chloe', single: 'B7', childUnits: [] }
                  ]
                }
              ]
            },
            {
              id: 'gooma2',
              single: 'F4',
              childUnits: [
                { id: 'ahfat', single: 'M14', childUnits: [], dashed: true }
              ]
            },
            {
              id: 'gooma3',
              single: 'X3',
              childUnits: [
                {
                  id: 'keith-manyi',
                  partners: ['F1', 'M6'],
                  childUnits: [
                    { id: 'natalie', single: 'M10', childUnits: [] }
                  ]
                },
                { id: 'cherry', single: 'M5', childUnits: [] }
              ]
            }
          ]
        }
      ]
    };
  }

  // Calculate width needed for each unit (including descendants)
  calculateWidths(familyUnits) {
    const calcWidth = (unit) => {
      // Base width of this unit
      let selfWidth = LAYOUT.personWidth;
      if (unit.partners) {
        const validPartners = unit.partners.filter(id => this.people.has(id));
        if (validPartners.length === 2) {
          selfWidth = LAYOUT.personWidth * 2 + LAYOUT.coupleGap;
        }
      }

      // Calculate children width
      if (unit.childUnits && unit.childUnits.length > 0) {
        let childrenWidth = 0;
        unit.childUnits.forEach((child, i) => {
          calcWidth(child);
          childrenWidth += child.totalWidth;
          if (i > 0) childrenWidth += LAYOUT.siblingGap;
        });
        unit.childrenWidth = childrenWidth;
        unit.totalWidth = Math.max(selfWidth, childrenWidth);
      } else {
        unit.childrenWidth = 0;
        unit.totalWidth = selfWidth;
      }
      unit.selfWidth = selfWidth;
    };

    familyUnits.roots.forEach(root => calcWidth(root));
  }

  // Position units top-down, centering children under parents
  positionUnits(familyUnits) {
    let x = LAYOUT.padding;
    const y = LAYOUT.padding;

    familyUnits.roots.forEach((root, i) => {
      if (i > 0) x += LAYOUT.familyGap;
      this.positionUnit(root, x, y, 0);
      x += root.totalWidth;
    });
  }

  positionUnit(unit, x, y, depth) {
    // Center this unit within its allocated width
    const centerX = x + unit.totalWidth / 2;
    const unitStartX = centerX - unit.selfWidth / 2;

    // Position this unit's people
    if (unit.partners) {
      const ids = unit.partners.filter(id => this.people.has(id));
      if (ids.length === 2) {
        this.positions.set(ids[0], { x: unitStartX, y, unitId: unit.id });
        this.positions.set(ids[1], { x: unitStartX + LAYOUT.personWidth + LAYOUT.coupleGap, y, unitId: unit.id });
      } else if (ids.length === 1) {
        this.positions.set(ids[0], { x: unitStartX, y, unitId: unit.id });
      }
    } else if (unit.single && this.people.has(unit.single)) {
      this.positions.set(unit.single, { x: unitStartX, y, unitId: unit.id });
    }

    // Position children
    if (unit.childUnits && unit.childUnits.length > 0) {
      const childY = y + LAYOUT.generationGap;
      // Center children block under parent
      let childX = centerX - unit.childrenWidth / 2;

      unit.childUnits.forEach((child, i) => {
        if (i > 0) childX += LAYOUT.siblingGap;
        this.positionUnit(child, childX, childY, depth + 1);
        childX += child.totalWidth;
      });
    }
  }

  buildConnections() {
    this.connections = [];

    // Parent-child connections
    const familyConnections = [
      { parents: ['X2', 'X1'], children: ['F6'], type: 'normal' },
      { parents: ['M7', 'M8'], children: ['M1', 'M9'], type: 'normal' },
      { parents: ['X6'], children: ['M2'], type: 'normal' },
      { parents: ['X4', 'X5'], children: ['F4', 'F5', 'X3'], type: 'normal' },
      { parents: ['F3', 'F2'], children: ['M4'], type: 'normal' },
      { parents: ['F5', 'F6'], children: ['B1', 'B11', 'B10'], type: 'normal' },
      { parents: ['M3', 'M4'], children: ['B3'], type: 'normal' },
      { parents: ['B12', 'B11'], children: ['B6', 'B8', 'B4'], type: 'normal' },
      { parents: ['B10', 'B9'], children: ['B5', 'B7'], type: 'normal' },
      { parents: ['X3'], children: ['M6', 'M5'], type: 'normal' },
      { parents: ['F1', 'M6'], children: ['M10'], type: 'normal' },
      { parents: ['F4'], children: ['M14'], type: 'dashed' }
    ];

    familyConnections.forEach(conn => {
      const parentPositions = conn.parents
        .filter(id => this.positions.has(id))
        .map(id => this.positions.get(id));

      const childPositions = conn.children
        .filter(id => this.positions.has(id))
        .map(id => ({ id, ...this.positions.get(id) }));

      if (parentPositions.length > 0 && childPositions.length > 0) {
        this.connections.push({
          type: 'parent-child',
          style: conn.type,
          parents: parentPositions,
          children: childPositions
        });
      }
    });

    // Nephew connection (Popo -> Yan)
    if (this.positions.has('X1') && this.positions.has('F7')) {
      this.connections.push({
        type: 'nephew',
        from: this.positions.get('X1'),
        to: this.positions.get('F7')
      });
    }
  }

  // Get center X of a person
  getCenterX(id) {
    const pos = this.positions.get(id);
    return pos ? pos.x + LAYOUT.personWidth / 2 : 0;
  }

  // Get bottom Y of a person
  getBottomY(id) {
    const pos = this.positions.get(id);
    return pos ? pos.y + LAYOUT.personHeight : 0;
  }

  // Get top Y of a person
  getTopY(id) {
    const pos = this.positions.get(id);
    return pos ? pos.y : 0;
  }
}

// Render the tree
function renderFlatTree(container, data, style = 'photos') {
  const layout = new FamilyTreeLayout(data);
  layout.calculateLayout();

  // Clear container
  container.innerHTML = '';

  // Create SVG for connections
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('lines');
  svg.setAttribute('id', 'lines');

  // Create people container
  const peopleDiv = document.createElement('div');
  peopleDiv.classList.add('people');
  peopleDiv.setAttribute('id', 'people');

  // Calculate total dimensions
  let maxX = 0, maxY = 0;
  layout.positions.forEach(pos => {
    maxX = Math.max(maxX, pos.x + LAYOUT.personWidth);
    maxY = Math.max(maxY, pos.y + LAYOUT.personHeight);
  });

  // Set container size
  container.style.width = (maxX + LAYOUT.padding) + 'px';
  container.style.height = (maxY + LAYOUT.padding + 20) + 'px';
  svg.style.width = (maxX + LAYOUT.padding) + 'px';
  svg.style.height = (maxY + LAYOUT.padding + 20) + 'px';

  // Render people
  layout.positions.forEach((pos, id) => {
    const person = layout.people.get(id);
    if (!person) return;

    const div = document.createElement('div');
    div.classList.add('person');
    div.setAttribute('id', id.toLowerCase());
    div.style.position = 'absolute';
    div.style.left = pos.x + 'px';
    div.style.top = pos.y + 'px';

    const photo = document.createElement('div');
    photo.classList.add('photo', person.gender === 'M' ? 'male' : 'female');

    // Photo path based on ID
    const photoId = id.toLowerCase();
    if (person.inPhoto !== false) {
      photo.style.backgroundImage = `url('thumbs/${style}/${photoId}.png')`;
    } else {
      photo.classList.add('no-photo');
    }

    const name = document.createElement('div');
    name.classList.add('name');
    // Use full name for short names, first name for long names
    const displayName = person.name.length <= 12 ? person.name : person.name.split(' ')[0];
    name.textContent = displayName;

    div.appendChild(photo);
    div.appendChild(name);

    if (person.aka) {
      const aka = document.createElement('div');
      aka.classList.add('aka');
      aka.textContent = `(${person.aka})`;
      div.appendChild(aka);
    }

    peopleDiv.appendChild(div);
  });

  container.appendChild(svg);
  container.appendChild(peopleDiv);

  // Draw connections after DOM is ready
  setTimeout(() => drawConnections(svg, layout), 0);

  return layout;
}

function drawConnections(svg, layout) {
  svg.innerHTML = '';

  layout.connections.forEach(conn => {
    if (conn.type === 'parent-child') {
      drawParentChildConnection(svg, conn, layout);
    } else if (conn.type === 'nephew') {
      drawNephewConnection(svg, conn);
    }
  });
}

function drawParentChildConnection(svg, conn, layout) {
  const parents = conn.parents;
  const children = conn.children;
  const isDashed = conn.style === 'dashed';

  // Calculate parent center point
  let parentCenterX;
  if (parents.length === 2) {
    parentCenterX = (parents[0].x + parents[1].x + LAYOUT.personWidth) / 2 + LAYOUT.coupleGap / 2;
  } else {
    parentCenterX = parents[0].x + LAYOUT.personWidth / 2;
  }
  const parentBottomY = parents[0].y + LAYOUT.personHeight;

  // Drop line from parent
  const dropY = parentBottomY + 12;

  // Calculate bar Y (midpoint to children)
  const childTopY = Math.min(...children.map(c => c.y));
  const barY = dropY + (childTopY - dropY) / 2;

  // Draw vertical drop from parents
  drawPath(svg, [
    { x: parentCenterX, y: parentBottomY },
    { x: parentCenterX, y: dropY }
  ], isDashed ? 'dashed' : '');

  if (children.length === 1) {
    // Single child - elbow
    const childX = children[0].x + LAYOUT.personWidth / 2;
    drawPath(svg, [
      { x: parentCenterX, y: dropY },
      { x: parentCenterX, y: barY },
      { x: childX, y: barY },
      { x: childX, y: children[0].y }
    ], isDashed ? 'dashed' : '');
  } else {
    // Multiple children - horizontal bar
    const childXs = children.map(c => c.x + LAYOUT.personWidth / 2);
    const leftX = Math.min(...childXs);
    const rightX = Math.max(...childXs);

    // Vertical to bar
    drawPath(svg, [
      { x: parentCenterX, y: dropY },
      { x: parentCenterX, y: barY }
    ], isDashed ? 'dashed' : '');

    // Horizontal bar
    drawPath(svg, [
      { x: leftX, y: barY },
      { x: rightX, y: barY }
    ], isDashed ? 'dashed' : '');

    // Vertical drops to each child
    children.forEach(child => {
      const childX = child.x + LAYOUT.personWidth / 2;
      drawPath(svg, [
        { x: childX, y: barY },
        { x: childX, y: child.y }
      ], isDashed ? 'dashed' : '');
    });
  }
}

function drawNephewConnection(svg, conn) {
  const fromX = conn.from.x + LAYOUT.personWidth / 2;
  const fromY = conn.from.y + LAYOUT.personHeight;
  const toX = conn.to.x + LAYOUT.personWidth / 2;
  const toY = conn.to.y;
  const midY = fromY + (toY - fromY) / 2;

  drawPath(svg, [
    { x: fromX, y: fromY },
    { x: fromX, y: midY },
    { x: toX, y: midY },
    { x: toX, y: toY }
  ], 'nephew');
}

function drawPath(svg, points, className = '') {
  if (points.length < 2) return;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  path.setAttribute('d', d);
  if (className) path.setAttribute('class', className);
  svg.appendChild(path);
}

// Export for use in diagram.html
window.FamilyTreeLayout = FamilyTreeLayout;
window.renderFlatTree = renderFlatTree;
