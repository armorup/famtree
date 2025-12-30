// Data-driven family tree layout engine
// Calculates positions and renders from family_tree.json

const LAYOUT = {
  personWidth: 60,
  personHeight: 80,
  coupleGap: 10,     // Gap between partners
  siblingGap: 20,    // Gap between siblings
  familyGap: 60,     // Gap between family units
  generationGap: 100, // Vertical gap between generations
  padding: 25
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

  // Main layout calculation
  calculateLayout() {
    this.calculateGenerations();
    this.groupByGeneration();

    // Define the tree structure manually for this specific family
    // This gives us precise control over positioning
    const tree = this.buildTreeStructure();

    let y = LAYOUT.padding;
    tree.forEach((row, genIndex) => {
      let x = LAYOUT.padding;

      row.forEach((unit, unitIndex) => {
        if (unitIndex > 0) x += LAYOUT.familyGap;

        x = this.layoutUnit(unit, x, y);
      });

      y += LAYOUT.generationGap;
    });

    this.buildConnections();
  }

  // Build tree structure defining the layout order
  buildTreeStructure() {
    // Manual tree structure for precise control
    // Each row is an array of "units" (couples/singles with optional children indicator)
    return [
      // Row 0: Great-grandparents
      [
        { partners: ['X2', 'X1'], id: 'ham-popo' },           // Ham & Popo
        { partners: ['M7', 'M8'], id: 'peter-cora' },         // Peter & Cora
        { partners: ['X6'], id: 'siukee' },                   // Siu-Kee
        { partners: ['X4', 'X5'], id: 'yehyeh-mama' }         // Yehyeh & Mama
      ],
      // Row 1: Grandparents
      [
        { partners: ['F7', 'M11'], id: 'yan-fun' },           // Yan & Aunt Fun
        { partners: ['F3', 'F2'], id: 'unclema-auntma' },     // Uncle Ma & Aunt Ma
        { single: 'M1', id: 'hong' },                         // Hong
        { single: 'M9', id: 'michelle' },                     // Michelle
        { single: 'M2', id: 'rex' },                          // Rex
        { partners: ['F5', 'F6'], id: 'ernest-amy' },         // Ernest & Amy
        { single: 'F4', id: 'gooma2' },                       // Gooma2
        { single: 'X3', id: 'gooma3' }                        // Gooma3
      ],
      // Row 2: Parents
      [
        { partners: ['M3', 'M4'], id: 'adrien-ada' },         // Adrien & Ada
        { partners: ['B1', 'B2'], id: 'stanley-angela' },     // Stanley & Angela
        { partners: ['B12', 'B11'], id: 'wilfred-mary' },     // Wilfred & Mary
        { partners: ['B10', 'B9'], id: 'stewart-mae' },       // Stewart & Mae
        { single: 'M14', id: 'ahfat' },                       // AhFat
        { partners: ['F1', 'M6'], id: 'keith-manyi' },        // Keith & Man-Yi
        { single: 'M5', id: 'cherry' }                        // Cherry
      ],
      // Row 3: Children
      [
        { single: 'B3', id: 'siah' },                         // Si Ah
        { single: 'B6', id: 'zachary' },                      // Zachary
        { single: 'B8', id: 'xavier' },                       // Xavier
        { single: 'B4', id: 'sebastian' },                    // Sebastian
        { single: 'B5', id: 'kayley' },                       // Kayley
        { single: 'B7', id: 'chloe' },                        // Chloe
        { single: 'M10', id: 'natalie' }                      // Natalie
      ]
    ];
  }

  layoutUnit(unit, x, y) {
    if (unit.partners) {
      // Couple
      const ids = unit.partners.filter(id => this.people.has(id));
      if (ids.length === 2) {
        this.positions.set(ids[0], { x, y, unitId: unit.id });
        x += LAYOUT.personWidth + LAYOUT.coupleGap;
        this.positions.set(ids[1], { x, y, unitId: unit.id });
        x += LAYOUT.personWidth;
      } else if (ids.length === 1) {
        this.positions.set(ids[0], { x, y, unitId: unit.id });
        x += LAYOUT.personWidth;
      }
    } else if (unit.single) {
      if (this.people.has(unit.single)) {
        this.positions.set(unit.single, { x, y, unitId: unit.id });
        x += LAYOUT.personWidth;
      }
    }

    return x;
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
