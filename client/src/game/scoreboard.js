export function createScoreboard() {
  const body = document.getElementById('scoreboard-body');
  let localId = null;

  function setLocalId(id) {
    localId = id;
  }

  function render(list) {
    if (!body) return;
    body.innerHTML = '';
    for (const row of list) {
      const tr = document.createElement('tr');
      if (row.id === localId) tr.classList.add('me');
      const name = document.createElement('td');
      name.textContent = row.name || row.id.slice(0, 4);
      const kills = document.createElement('td');
      kills.className = 'num';
      kills.textContent = String(row.kills);
      const deaths = document.createElement('td');
      deaths.className = 'num';
      deaths.textContent = String(row.deaths);
      tr.appendChild(name);
      tr.appendChild(kills);
      tr.appendChild(deaths);
      body.appendChild(tr);
    }
  }

  return { setLocalId, render };
}
