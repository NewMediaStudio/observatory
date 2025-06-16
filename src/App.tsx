import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as d3Hexbin from 'd3-hexbin';
import 'remixicon/fonts/remixicon.css';
import './App.css';

interface Process {
  id: string;
  name: string;
  status: string;
  group?: string;
  connections?: string[];
  weight: number;
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  status: string;
  group?: string;
  weight: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: NetworkNode;
  target: NetworkNode;
  value: number;
}

interface Node {
  id: string;
  x: number;
  y: number;
  radius: number;
  hasAnomaly: boolean;
  tag: string;
  properties: {
    name: string;
    type: string;
    status: string;
    processes: Process[];
  };
}

const App: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [expandedProcess, setExpandedProcess] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Generate sample data
    const generateNodes = () => {
      const nodes: Node[] = [];
      const groups = {
        'Production': { count: 568, anomalyRate: 0.08 },
        'Staging': { count: 384, anomalyRate: 0.05 },
        'Development': { count: 287, anomalyRate: 0.03 },
        'Testing': { count: 133, anomalyRate: 0.02 },
        'Monitoring': { count: 50, anomalyRate: 0.1 }
      };

      // Generate nodes for each group
      Object.entries(groups).forEach(([tag, config]) => {
        // Create subclusters for better distribution
        const subclusterCount = Math.ceil(config.count / 15);
        const subclusters = Array.from({ length: subclusterCount }, () => ({
          centerX: Math.random() * (dimensions.width * 0.6) + (dimensions.width * 0.2),
          centerY: Math.random() * (dimensions.height * 0.6) + (dimensions.height * 0.2),
          radius: Math.min(dimensions.width, dimensions.height) * 0.15
        }));

        // First pass: create all processes for this group
        const groupProcesses: Process[] = [];
        let currentProcessIndex = 0;
        
        // Track node positions to avoid overlap
        const nodePositions: { x: number; y: number; hasAnomaly: boolean }[] = [];
        const allNodes: { x: number; y: number; hasAnomaly: boolean; fx?: number; fy?: number }[] = [];
        
        for (let i = 0; i < config.count; i++) {
          // Pure random number between 1 and 100
          const processCount = Math.floor(Math.random() * 100) + 1;
          
          // Create processes for this specific node
          const nodeProcesses: Process[] = [];
          const hasAnomaly = Math.random() < config.anomalyRate;
          
          // For nodes with anomalies, ensure only 1-9 suspicious processes
          const problematicProcessCount = hasAnomaly ? Math.floor(Math.random() * 9) + 1 : 0; // 1-9 suspicious processes
          
          // First create the problematic processes for anomalous nodes
          for (let j = 0; j < problematicProcessCount; j++) {
            // For anomalous nodes, create suspicious processes
            const status = j % 2 === 0 ? 'Error' : 'Warning';
            const group = ['Core', 'Network', 'Storage', 'Security', 'Monitoring'][Math.floor(Math.random() * 5)];
            const weight = Math.floor(Math.random() * 3) + 1;
            
            const process = {
              id: `proc-${tag}-${i}-${j}`,
              name: `${group} Process ${j}`,
              status,
              group,
              connections: [],
              weight
            };
            
            nodeProcesses.push(process);
            groupProcesses.push(process);
          }
          
          // Then create the remaining processes (all OK)
          for (let j = problematicProcessCount; j < processCount; j++) {
            const status = 'OK'; // All remaining processes are OK
            const group = ['Core', 'Network', 'Storage', 'Security', 'Monitoring'][Math.floor(Math.random() * 5)];
            const weight = Math.floor(Math.random() * 3) + 1;
            
            const process = {
              id: `proc-${tag}-${i}-${j}`,
              name: `${group} Process ${j}`,
              status,
              group,
              connections: [],
              weight
            };
            
            nodeProcesses.push(process);
            groupProcesses.push(process);
          }

          // Create nodes with their processes
          const subcluster = subclusters[i % subclusterCount];
          const baseAngle = (i / (config.count / subclusterCount)) * Math.PI * 2;
          const angleVariation = (Math.random() - 0.5) * 0.2;
          const angle = baseAngle + angleVariation;
          
          // Adjust distance based on whether node has anomaly
          const minDistance = subcluster.radius * (hasAnomaly ? 0.5 : 0.4);
          const maxDistance = subcluster.radius * (hasAnomaly ? 0.8 : 0.9);
          const distance = minDistance + Math.random() * (maxDistance - minDistance);
          
          let x = subcluster.centerX + Math.cos(angle) * distance;
          let y = subcluster.centerY + Math.sin(angle) * distance;

          allNodes.push({ x, y, hasAnomaly });
          nodePositions.push({ x, y, hasAnomaly });

          nodes.push({
            id: `${tag}-${i}`,
            x,
            y,
            radius: 5,
            hasAnomaly,
            tag,
            properties: {
              name: `${tag} Asset ${i}`,
              type: ['Server', 'Database', 'Service'][Math.floor(Math.random() * 3)],
              status: hasAnomaly ? 'Warning' : 'Active',
              processes: nodeProcesses
            }
          });
        }

        // Apply force simulation to all nodes
        if (allNodes.length > 0) {
          const simulation = d3.forceSimulation(allNodes)
            .force('collision', d3.forceCollide().radius(d => d.hasAnomaly ? 60 : 25).strength(1.5))
            .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.05))
            .force('x', d3.forceX(dimensions.width / 2).strength(0.05))
            .force('y', d3.forceY(dimensions.height / 2).strength(0.05))
            .stop();

          // Run the simulation for more iterations to ensure stable positioning
          for (let i = 0; i < 800; ++i) simulation.tick();

          // Update node positions
          allNodes.forEach((node, i) => {
            const nodeIndex = nodes.findIndex(n => n.hasAnomaly === node.hasAnomaly && n.x === node.x && n.y === node.y);
            if (nodeIndex !== -1) {
              // Ensure nodes stay within bounds
              const minDistance = node.hasAnomaly ? 60 : 25;
              nodes[nodeIndex].x = Math.max(minDistance, Math.min(dimensions.width - minDistance, node.x));
              nodes[nodeIndex].y = Math.max(minDistance, Math.min(dimensions.height - minDistance, node.y));
            }
          });
        }

        // Second pass: create connections between processes
        groupProcesses.forEach((process, index) => {
          // Connect to 2-4 other processes in the same group
          const numConnections = Math.floor(Math.random() * 3) + 2;
          for (let k = 0; k < numConnections; k++) {
            const targetIndex = (index + k + 1) % groupProcesses.length;
            process.connections.push(groupProcesses[targetIndex].id);
          }
        });
      });

      return nodes;
    };

    setNodes(generateNodes());
  }, [dimensions]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;

    // Clear previous elements
    svg.selectAll('*').remove();

    // Create hexbin generator
    const hexbin = d3Hexbin.hexbin<Node>()
      .x(d => d.x)
      .y(d => d.y)
      .radius(15)
      .extent([[0, 0], [width, height]]);

    // Group nodes by their hexbin
    const bins = hexbin(nodes);

    // Create color scale for intensity
    const colorScale = d3.scaleLinear<number>()
      .domain([0, 1, 5, 10])
      .range(['#e0e0e0', '#d32f2f', '#b71c1c', '#7f0000']);

    // Draw hexbins
    const hexGroup = svg.append('g')
      .selectAll<SVGPathElement, d3Hexbin.HexbinBin<Node>>('path')
      .data(bins)
      .enter()
      .append('path')
      .attr('d', hexbin.hexagon())
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .attr('fill', d => {
        const issueCount = d.filter(node => node.hasAnomaly).length;
        return colorScale(issueCount);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .style('animation-delay', () => `${Math.random() * 3}s`)
      .classed('hexbin-anomaly', d => d.filter(node => node.hasAnomaly).length > 0)
      .on('mouseenter', function(event, d: d3Hexbin.HexbinBin<Node>) {
        // Remove animation class on hover
        d3.select(this).classed('hexbin-anomaly', false);
        d3.select(this)
          .transition()
          .duration(200)
          .attr('fill', () => {
            const issueCount = d.filter(node => node.hasAnomaly).length;
            if (issueCount === 0) {
              return '#2e7d32';
            }
            const baseColor = colorScale(issueCount);
            return d3.color(baseColor)?.darker(0.3).toString() || baseColor;
          });

        // Add text label for suspicious processes count
        const issueCount = d.filter(node => node.hasAnomaly).length;
        if (issueCount > 0) {
          // Find the node with the most suspicious processes
          const nodeWithMostIssues = d.reduce((max, node) => {
            const currentIssues = node.properties.processes.filter(p => p.status !== 'OK').length;
            const maxIssues = max.properties.processes.filter(p => p.status !== 'OK').length;
            return currentIssues > maxIssues ? node : max;
          }, d[0]);
          
          const suspiciousCount = nodeWithMostIssues.properties.processes.filter(p => p.status !== 'OK').length;
          
          svg.append('text')
            .attr('class', 'hex-label')
            .attr('x', d.x)
            .attr('y', d.y)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '10px')
            .attr('pointer-events', 'none')
            .text(suspiciousCount);
        }
      })
      .on('mouseleave', function(event, d: d3Hexbin.HexbinBin<Node>) {
        // Restore animation class on mouse leave
        d3.select(this).classed('hexbin-anomaly', d.filter(node => node.hasAnomaly).length > 0);
        d3.select(this)
          .transition()
          .duration(200)
          .attr('fill', () => {
            const issueCount = d.filter(node => node.hasAnomaly).length;
            return colorScale(issueCount);
          });

        // Remove text label
        svg.selectAll('.hex-label').remove();
      })
      .on('click', (event, d) => {
        // Find the node with the most suspicious processes in this bin
        const nodeWithMostIssues = d.reduce((max, node) => {
          const currentIssues = node.properties.processes.filter(p => p.status !== 'OK').length;
          const maxIssues = max.properties.processes.filter(p => p.status !== 'OK').length;
          return currentIssues > maxIssues ? node : max;
        }, d[0]);

        // Select the node (whether it has suspicious processes or not)
        setSelectedNode(nodeWithMostIssues);
      });

    // Add count labels
    hexGroup.append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', d => {
        const issueCount = d.filter(node => node.hasAnomaly).length;
        return issueCount > 0 ? '#ffffff' : '#2e7d32';
      })
      .attr('font-size', '12px')
      .text(d => d.length);

  }, [nodes, dimensions]);

  // Add effect to expand first suspicious process when node is selected
  useEffect(() => {
    if (selectedNode?.hasAnomaly) {
      const firstSuspiciousProcess = selectedNode.properties.processes
        .find(proc => proc.status !== 'OK');
      if (firstSuspiciousProcess) {
        setExpandedProcess(firstSuspiciousProcess.id);
      }
    } else {
      setExpandedProcess(null);
    }
  }, [selectedNode]);

  const renderProcessGraph = (processId: string, containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear previous content
    d3.select(container).selectAll('*').remove();

    const width = 400;
    const height = 200;
    const padding = 40; // Increased padding from 20 to 40
    const graphWidth = width - (padding * 2);
    const graphHeight = height - (padding * 2);

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('style', 'max-width: 100%; height: auto; background: white; border-radius: 4px;');

    // Add arrow marker definition
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#999')
      .style('stroke', 'none');

    // Generate sample nodes for the process
    const nodeCount = Math.floor(Math.random() * 6) + 15; // 15-20 nodes
    const graphNodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: `node-${i}`,
      name: `Component ${i}`,
      status: Math.random() > 0.8 ? 'Error' : Math.random() > 0.6 ? 'Warning' : 'OK',
      group: ['Core', 'Network', 'Storage', 'Security', 'Monitoring'][Math.floor(Math.random() * 5)]
    }));

    // Generate random connections
    const links = [];
    for (let i = 0; i < graphNodes.length; i++) {
      const connectionCount = Math.floor(Math.random() * 3) + 1; // 1-3 connections per node
      for (let j = 0; j < connectionCount; j++) {
        const targetIndex = Math.floor(Math.random() * graphNodes.length);
        if (targetIndex !== i) {
          links.push({
            source: graphNodes[i].id,
            target: graphNodes[targetIndex].id,
            value: Math.random() * 3 + 1
          });
        }
      }
    }

    // Create a color scale for groups
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    // Create the force simulation
    const simulation = d3.forceSimulation(graphNodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(40))  // Reduced from 50 to 40
      .force('charge', d3.forceManyBody().strength(-100))  // Reduced from -150 to -100
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.1))  // Increased from 0.05 to 0.1
      .force('x', d3.forceX(width / 2).strength(0.1))  // Increased from 0.05 to 0.1
      .force('y', d3.forceY(height / 2).strength(0.1))  // Increased from 0.05 to 0.1
      .force('collision', d3.forceCollide().radius(10))  // Reduced from 12 to 10
      .force('boundary', () => {
        return alpha => {
          graphNodes.forEach(node => {
            // Keep nodes within the padded area with more strict boundaries
            node.x = Math.max(padding + 10, Math.min(graphWidth + padding - 10, node.x));
            node.y = Math.max(padding + 10, Math.min(graphHeight + padding - 10, node.y));
          });
        };
      });

    // Create the links
    const link = svg.append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.4)  // Reduced opacity from 0.6 to 0.4
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value) * 0.5)  // Reduced thickness by half
      .attr('marker-end', 'url(#arrowhead)');  // Add arrow marker

    // Create the nodes
    const node = svg.append('g')
      .selectAll('circle')
      .data(graphNodes)
      .join('circle')
      .attr('r', 3)
      .attr('fill', d => d.status === 'OK' ? '#2e7d32' : d.status === 'Warning' ? '#ffa000' : '#d32f2f')
      .attr('stroke', d => color(d.group))
      .attr('stroke-width', 1)
      .call(drag(simulation));

    // Add labels
    const label = svg.append('g')
      .selectAll('text')
      .data(graphNodes)
      .join('text')
      .text(d => d.name.split(' ')[1])
      .attr('font-size', '6px')
      .attr('fill', '#333')
      .attr('text-anchor', 'middle')
      .attr('dy', -5);

    // Add a legend for groups
    const legend = svg.append('g')
      .attr('font-size', 6)
      .attr('text-anchor', 'start')
      .selectAll('g')
      .data(color.domain())
      .join('g')
      .attr('transform', (d, i) => `translate(12,${12 + (i * 8)})`);

    legend.append('rect')
      .attr('x', 0)
      .attr('y', -2.5)  // Center the rect vertically
      .attr('width', 5)
      .attr('height', 5)
      .attr('fill', color);

    legend.append('text')
      .attr('x', 7)
      .attr('y', 1)  // Adjust text baseline to align with rect center
      .attr('dominant-baseline', 'middle')  // Center text vertically
      .text(d => d);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    // Drag functions
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }
  };

  useEffect(() => {
    if (expandedProcess) {
      // Small delay to ensure DOM element exists
      setTimeout(() => {
        renderProcessGraph(expandedProcess, `process-graph-${expandedProcess}`);
      }, 100);
    }
  }, [expandedProcess]);

  return (
    <div className="app" onClick={(e) => {
      if (e.target === e.currentTarget) {
        setSelectedNode(null);
      }
    }}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ background: 'white' }}
      />
      <div className="total-count">
        <i className="ri-server-line" style={{ color: 'white', marginRight: '8px', fontSize: '16px', verticalAlign: 'middle' }}></i>
        {nodes.length.toLocaleString()} assets
      </div>
      {selectedNode && (
        <div className={`node-details ${selectedNode.hasAnomaly ? 'anomaly' : ''}`}>
          <div className="close-icon" onClick={() => setSelectedNode(null)} />
          <h1>
            {selectedNode.properties.name}
          </h1>
          <p>
            <i className="ri-hard-drive-line" style={{ color: '#757575', marginRight: '8px', fontSize: '16px', verticalAlign: 'middle' }}></i>
            {selectedNode.properties.type}
          </p>
          <p>
            <i className="ri-price-tag-3-line" style={{ color: '#757575', marginRight: '8px', fontSize: '16px', verticalAlign: 'middle' }}></i>
            {selectedNode.tag}
          </p>
          
          {selectedNode.hasAnomaly ? (
            <>
              <div className="process-summary suspicious">
                <p>Total Processes: {selectedNode.properties.processes.length}</p>
                <p>Suspicious Processes: <span>{
                  selectedNode.properties.processes.filter(p => p.status !== 'OK').length
                }</span></p>
              </div>
              <h3>Suspicious Processes:</h3>
              <ul className="process-list">
                {selectedNode.properties.processes
                  .filter(proc => proc.status !== 'OK')
                  .map(proc => (
                    <li key={proc.id}>
                      <div 
                        className="process-item suspicious"
                        onClick={() => setExpandedProcess(expandedProcess === proc.id ? null : proc.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span style={{ color: proc.status !== 'OK' ? '#d32f2f' : 'inherit', fontWeight: 600 }}>
                          {proc.name} - {proc.status} ({proc.group})
                        </span>
                        <span className="expand-icon">{expandedProcess === proc.id ? '−' : '+'}</span>
                      </div>
                      {expandedProcess === proc.id && (
                        <div className="process-graph-container">
                          <div className="process-actions">
                            <button 
                              className="action-button ignore"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement ignore action
                              }}
                            >
                              <i className="ri-eye-off-fill"></i>
                              <span>Ignore</span>
                            </button>
                            <button 
                              className="action-button whitelist"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement whitelist action
                              }}
                            >
                              <i className="ri-shield-check-fill"></i>
                              <span>Whitelist</span>
                            </button>
                            <button 
                              className="action-button escalate"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement escalate action
                              }}
                            >
                              <i className="ri-alert-fill"></i>
                              <span>Escalate</span>
                            </button>
                          </div>
                          <div id={`process-graph-${proc.id}`} className="process-graph"></div>
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <>
              <div className="process-summary">
                <p>All {selectedNode.properties.processes.length} processes are OK</p>
              </div>
              <h3>Process List:</h3>
              <ul className="process-list">
                {selectedNode.properties.processes
                  .filter(proc => proc.status === 'OK')
                  .map(proc => (
                    <li key={proc.id}>
                      {proc.name} - {proc.status}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default App; 