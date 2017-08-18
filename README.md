# Gene summaries

Creates a simple summary of gene matching results presented on this format:

```
ID	NAME	ORGANISM	SCORE	CODE	TAXID	family	species	genus	order	class	phylum
WP_033858745.1	phage protein 	Staphylococcus aureus	173.5	1	1280	Staphylococcaceae	Staphylococcus aureus	Staphylococcus	Bacillales	Bacilli	Firmicutes
WP_033861695.1	phage protein 	Staphylococcus aureus	172.9	1	1280	Staphylococcaceae	Staphylococcus aureus	Staphylococcus	Bacillales	Bacilli	Firmicutes
```

Creates the clouds using the ORGANISM (or family, species, genus, order, class or phylum) column. It computes the sizes adding up the SCORE field

To run it locally start a local web server, if you have python2.7

```
python -m SimpleHTTPServer 8080
```

Then open http://localhost:8080(http://localhost:8080) on your web browser