export function post(url, data) {
  console.log(`POSTING to ${url} with data ${JSON.stringify(data)}`);

  return fetch( url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  }).then((response) => response.json());

}

export function changeThreshold(threshold, root, icicle) {
  // console.log('Changing threshold ', threshold);
  // var prunedTree = pruneTree(threshold, root.copy());
  // icicle.draw(prunedTree);

}

export function filter(threshold, root, dendogram) {
  // console.log('Changing threshold ', threshold);
  // var prunedTree = pruneTree(threshold, root.copy());
  // dendogram.draw(prunedTree);

}